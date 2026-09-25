// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IRouter } from "../src/interfaces/IRouter.sol";

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
import { CollateralConfig, Mode } from "../src/interfaces/ILoanManager.sol";

import { MockERC20 } from "./mocks/MockERC20.sol";
import { MockRouter } from "./mocks/MockRouter.sol";
import { MockMSR } from "./mocks/MockMSR.sol";
import { MockPriceFeed } from "./mocks/MockPriceFeed.sol";

/// @notice Wires up the full Thaw system with MockVeAdapter as collateral, for fast unit tests of
///         LoanManager/Harvester/RiskEngine/TMUSDVault that don't depend on a real ve/Voter ABI.
///         See VeBTCAdapterIntegration.t.sol for the Solidly-voter-shaped adapter path.
abstract contract TestBase is Test {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 1e4;

    address internal governance = makeAddr("governance");
    address internal lp = makeAddr("lp");
    address internal borrower = makeAddr("borrower");
    address internal keeper = makeAddr("keeper");

    MockERC20 internal musd;
    ThawEscrow internal escrow;
    PositionNFT internal positionNFT;
    RiskEngine internal riskEngine;
    TMUSDVault internal vault;
    OracleRouter internal oracleRouter;
    LoanManager internal loanManager;
    Harvester internal harvester;
    StrategyRegistry internal strategyRegistry;
    ReserveFund internal reserveFund;
    DutchAuctionLiquidator internal liquidator;
    MockVeAdapter internal mockAdapter;
    MockVotingEscrow internal mockVE;
    MockRouter internal mockRouter;
    MockMSR internal mockMSR;
    MockPriceFeed internal musdFeed;

    function setUp() public virtual {
        vm.startPrank(governance);

        musd = new MockERC20("Mock MUSD", "mUSD");
        mockRouter = new MockRouter();
        mockMSR = new MockMSR(address(musd));

        escrow = new ThawEscrow(governance);
        positionNFT = new PositionNFT(governance);
        riskEngine = new RiskEngine(governance);
        vault = new TMUSDVault(musd, governance);
        oracleRouter = new OracleRouter(governance, address(mockRouter), address(musd));
        strategyRegistry = new StrategyRegistry(governance);
        reserveFund = new ReserveFund(governance, address(musd));

        loanManager = new LoanManager(
            governance, address(musd), address(escrow), address(vault), address(riskEngine), address(positionNFT)
        );
        harvester = new Harvester(
            governance,
            address(loanManager),
            address(riskEngine),
            address(mockRouter),
            address(oracleRouter),
            address(musd)
        );
        liquidator = new DutchAuctionLiquidator(
            governance, address(loanManager), address(escrow), address(vault), address(reserveFund), address(musd)
        );

        mockVE = new MockVotingEscrow("Mock veNFT", "mveNFT", governance);
        mockAdapter = new MockVeAdapter(governance, address(mockVE), address(musd));
        mockVE.setVoterContract(address(mockAdapter));

        // wiring
        escrow.setLoanManager(address(loanManager));
        escrow.setLiquidator(address(liquidator));
        escrow.setHarvester(address(harvester));

        positionNFT.setLoanManager(address(loanManager));

        vault.setLoanManager(address(loanManager));
        vault.setLiquidator(address(liquidator));
        vault.setMSR(address(mockMSR));

        riskEngine.setHarvester(address(harvester));
        riskEngine.setLoanManager(address(loanManager));
        riskEngine.setOracleRouter(address(oracleRouter));

        loanManager.setHarvester(address(harvester));
        loanManager.setLiquidator(address(liquidator));
        loanManager.setAdapter(address(mockAdapter), true);

        harvester.setStrategyRegistry(address(strategyRegistry));
        harvester.setReserveFund(address(reserveFund));

        reserveFund.setLiquidator(address(liquidator));

        mockAdapter.setHarvester(address(harvester));
        mockAdapter.setLoanManager(address(loanManager));

        musdFeed = new MockPriceFeed(18, int256(WAD));
        IRouter.Route[] memory emptyRoute = new IRouter.Route[](0);
        oracleRouter.configureFeed(address(musd), address(musdFeed), 365 days, 10000, emptyRoute);

        CollateralConfig memory cfg = CollateralConfig({
            enabled: true,
            advanceWeeks: 10,
            incomeHaircutBps: 7500,
            maxLtvBps: 2500,
            liqLtvBps: 4000,
            protocolFeeBps: 1000,
            debtCeiling: 1_000_000e18,
            totalBorrowed: 0
        });
        riskEngine.setConfig(address(mockAdapter), cfg);
        riskEngine.setDefaultApr(address(mockAdapter), 600); // 6%

        vm.stopPrank();

        // seed lender liquidity
        musd.mint(lp, 1_000_000e18);
        vm.startPrank(lp);
        musd.approve(address(vault), type(uint256).max);
        vault.deposit(1_000_000e18, lp);
        vm.stopPrank();
    }

    function _mintVeNFT(address to, uint256 amount, uint256 lockEnd, bool permanent)
        internal
        returns (uint256 tokenId)
    {
        vm.prank(governance);
        tokenId = mockVE.mint(to, amount, lockEnd, permanent);
    }

    function _openAdvanceLoan(uint256 tokenId, uint256 weeklyReward, uint256 borrowAmount, uint16 repayShareBps)
        internal
        returns (uint256 loanId)
    {
        vm.prank(governance);
        mockAdapter.setWeeklyReward(tokenId, weeklyReward);

        vm.prank(borrower);
        mockVE.approve(address(escrow), tokenId);

        vm.prank(borrower);
        loanId = loanManager.openLoan(address(mockAdapter), tokenId, Mode.Advance, borrowAmount, repayShareBps);
    }
}
