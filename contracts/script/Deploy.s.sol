// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console } from "forge-std/Script.sol";

import { ThawEscrow } from "../src/core/ThawEscrow.sol";
import { PositionNFT } from "../src/core/PositionNFT.sol";
import { RiskEngine } from "../src/core/RiskEngine.sol";
import { LoanManager } from "../src/core/LoanManager.sol";
import { Harvester } from "../src/core/Harvester.sol";
import { TMUSDVault } from "../src/vault/TMUSDVault.sol";
import { OracleRouter } from "../src/oracle/OracleRouter.sol";
import { StrategyRegistry } from "../src/strategy/StrategyRegistry.sol";
import { ReserveFund } from "../src/liquidation/ReserveFund.sol";
import { DutchAuctionLiquidator } from "../src/liquidation/DutchAuctionLiquidator.sol";
import { MockVeAdapter } from "../src/adapters/MockVeAdapter.sol";
import { MockVotingEscrow } from "../src/adapters/mocks/MockVotingEscrow.sol";
import { MockRewardToken } from "../src/adapters/mocks/MockRewardToken.sol";
import { VeBTCAdapter } from "../src/adapters/VeBTCAdapter.sol";
import { FixedPriceFeed } from "../src/oracle/FixedPriceFeed.sol";
import { ThawFaucet } from "../src/testnet/ThawFaucet.sol";
import { IRouter } from "../src/interfaces/IRouter.sol";
import { CollateralConfig, Mode } from "../src/interfaces/ILoanManager.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Deploy
/// @notice Deploys the full Thaw stack. Reads addresses from env vars so the same script targets
///         Anvil (all mocked), or Mezo testnet (real MUSD + veBTC + Voter + Router, §6.2).
///
///         Required env vars:
///           PRIVATE_KEY        - deployer key
///           MUSD_ADDRESS       - real MUSD token (testnet) or leave unset to deploy a mock
///           VEBTC_ADDRESS      - real veBTC VotingEscrow (testnet) or unset to skip VeBTCAdapter
///           VEBTC_VOTER        - real veBTC Voter (testnet) or unset
///           ROUTER_ADDRESS     - Mezo Pools Router, or unset to skip Harvester swap wiring
///           BTC_USD_FEED       - Chainlink-style BTC/USD feed, or unset
///
///         Run: forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast --verify
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address musd = vm.envOr("MUSD_ADDRESS", address(0));
        address veBTC = vm.envOr("VEBTC_ADDRESS", address(0));
        address veBTCVoter = vm.envOr("VEBTC_VOTER", address(0));
        address router = vm.envOr("ROUTER_ADDRESS", address(0));
        address btcUsdFeed = vm.envOr("BTC_USD_FEED", address(0));

        vm.startBroadcast(deployerKey);

        bool mockMusd = musd == address(0);
        if (mockMusd) {
            musd = address(new MockRewardToken("Mock MUSD", "mUSD", deployer));
            console.log("Deployed mock MUSD at", musd);
        }

        ThawEscrow escrow = new ThawEscrow(deployer);
        PositionNFT positionNFT = new PositionNFT(deployer);
        RiskEngine riskEngine = new RiskEngine(deployer);
        TMUSDVault vault = new TMUSDVault(IERC20(musd), deployer);
        OracleRouter oracleRouter = new OracleRouter(deployer, router, musd);
        StrategyRegistry strategyRegistry = new StrategyRegistry(deployer);
        ReserveFund reserveFund = new ReserveFund(deployer, musd);

        LoanManager loanManager =
            new LoanManager(deployer, musd, address(escrow), address(vault), address(riskEngine), address(positionNFT));
        Harvester harvester =
            new Harvester(deployer, address(loanManager), address(riskEngine), router, address(oracleRouter), musd);
        DutchAuctionLiquidator liquidator = new DutchAuctionLiquidator(
            deployer, address(loanManager), address(escrow), address(vault), address(reserveFund), musd
        );

        escrow.setLoanManager(address(loanManager));
        escrow.setLiquidator(address(liquidator));
        escrow.setHarvester(address(harvester));

        positionNFT.setLoanManager(address(loanManager));

        vault.setLoanManager(address(loanManager));
        vault.setLiquidator(address(liquidator));

        riskEngine.setHarvester(address(harvester));
        riskEngine.setLoanManager(address(loanManager));
        riskEngine.setOracleRouter(address(oracleRouter));

        loanManager.setHarvester(address(harvester));
        loanManager.setLiquidator(address(liquidator));

        harvester.setStrategyRegistry(address(strategyRegistry));
        harvester.setReserveFund(address(reserveFund));

        reserveFund.setLiquidator(address(liquidator));

        // --- veBTC adapter (real, if addresses were supplied; §19 Day 18) ---
        if (veBTC != address(0) && veBTCVoter != address(0)) {
            VeBTCAdapter veBTCAdapter =
                new VeBTCAdapter(deployer, veBTC, address(escrow), veBTCVoter, address(oracleRouter), btcUsdFeed);
            escrow.setAdapter(address(veBTCAdapter), true);
            escrow.setAllowedTarget(veBTCVoter, true);
            veBTCAdapter.setHarvester(address(harvester));
            veBTCAdapter.setLoanManager(address(loanManager));
            loanManager.setAdapter(address(veBTCAdapter), true);

            riskEngine.setConfig(
                address(veBTCAdapter),
                CollateralConfig({
                    enabled: true,
                    advanceWeeks: 4,
                    incomeHaircutBps: 8000,
                    maxLtvBps: 6000,
                    liqLtvBps: 7500,
                    protocolFeeBps: 1000,
                    debtCeiling: 50_000e18,
                    totalBorrowed: 0
                })
            );
            riskEngine.setDefaultApr(address(veBTCAdapter), 500); // 5%
            strategyRegistry.setVoterOf(address(veBTCAdapter), veBTCVoter);

            console.log("VeBTCAdapter:", address(veBTCAdapter));
        } else {
            console.log("Skipped VeBTCAdapter: set VEBTC_ADDRESS/VEBTC_VOTER to deploy it");
        }

        // --- mock adapter: always deployed, as the demo fallback (§8.3, §22, §23) ---
        MockVotingEscrow mockVE = new MockVotingEscrow("Thaw Mock veNFT", "tmveNFT", deployer);
        MockVeAdapter mockAdapter = new MockVeAdapter(deployer, address(mockVE), musd);
        mockAdapter.setHarvester(address(harvester));
        mockAdapter.setLoanManager(address(loanManager));
        loanManager.setAdapter(address(mockAdapter), true);
        riskEngine.setConfig(
            address(mockAdapter),
            CollateralConfig({
                enabled: true,
                advanceWeeks: 10,
                incomeHaircutBps: 7500,
                maxLtvBps: 2500,
                liqLtvBps: 4000,
                protocolFeeBps: 1000,
                debtCeiling: 50_000e18,
                totalBorrowed: 0
            })
        );
        riskEngine.setDefaultApr(address(mockAdapter), 600); // 6%

        if (mockMusd) {
            // Mock MUSD has no oracle: price it at a constant $1 so RiskEngine can size loans.
            FixedPriceFeed musdFeed = new FixedPriceFeed(8, 1e8);
            oracleRouter.configureFeed(musd, address(musdFeed), 1 days, 500, new IRouter.Route[](0));
            // The mock adapter "claims" rewards by minting MUSD, so it must own the token. Keep a
            // stash with the deployer first for funding the vault and test wallets.
            MockRewardToken(musd).mint(deployer, 10_000_000e18);
            MockRewardToken(musd).transferOwnership(address(mockAdapter));
            console.log("MUSD feed:", address(musdFeed));

            // Public faucet so any wallet can try the app: it mints demo locks (owns the mock ve)
            // and presets their rewards (owns the mock adapter). Admin stays reachable via
            // faucet.execute. Harvest votes need the adapter registered as the ve's voter.
            ThawFaucet faucet = new ThawFaucet(deployer, IERC20(musd), mockVE, mockAdapter);
            IERC20(musd).transfer(address(faucet), 5_000_000e18);
            mockVE.setVoterContract(address(mockAdapter));
            mockVE.transferOwnership(address(faucet));
            mockAdapter.transferOwnership(address(faucet));
            console.log("ThawFaucet:", address(faucet));
        }

        vm.stopBroadcast();

        console.log("--- Thaw deployment ---");
        console.log("MUSD:", musd);
        console.log("ThawEscrow:", address(escrow));
        console.log("PositionNFT:", address(positionNFT));
        console.log("RiskEngine:", address(riskEngine));
        console.log("TMUSDVault:", address(vault));
        console.log("OracleRouter:", address(oracleRouter));
        console.log("StrategyRegistry:", address(strategyRegistry));
        console.log("ReserveFund:", address(reserveFund));
        console.log("LoanManager:", address(loanManager));
        console.log("Harvester:", address(harvester));
        console.log("DutchAuctionLiquidator:", address(liquidator));
        console.log("MockVotingEscrow:", address(mockVE));
        console.log("MockVeAdapter:", address(mockAdapter));
    }
}
