// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { SolidlyVeAdapter } from "./SolidlyVeAdapter.sol";
import { BaseVeAdapter } from "./BaseVeAdapter.sol";
import { IVotingEscrow } from "../interfaces/IVotingEscrow.sol";
import { IOracleRouter } from "../interfaces/IOracleRouter.sol";

/// @title VeBTCAdapter
/// @notice Adapter over Mezo's veBTC VotingEscrow + Voter (tigris, verified testnet deployment,
///         docs §6.2). Collateral is a short (<=28 day) BTC lock, so it is the lowest-risk asset
///         and the one Wave 1 ships against real contracts first (§19, §23).
contract VeBTCAdapter is SolidlyVeAdapter {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 1e4;
    uint256 internal constant DISCOUNT_BPS = 9500; // D_btc = 0.95, §9.3

    IOracleRouter public oracleRouter;
    address public btcPriceToken; // the token address the OracleRouter has a BTC/USD feed for

    constructor(
        address initialOwner,
        address _veBTC,
        address _thawEscrow,
        address _voter,
        address _oracleRouter,
        address _btcPriceToken
    ) BaseVeAdapter(initialOwner, _veBTC, _thawEscrow) SolidlyVeAdapter(_voter) {
        oracleRouter = IOracleRouter(_oracleRouter);
        btcPriceToken = _btcPriceToken;
    }

    function setOracleRouter(address _oracleRouter) external onlyOwner {
        oracleRouter = IOracleRouter(_oracleRouter);
    }

    function setBtcPriceToken(address token) external onlyOwner {
        btcPriceToken = token;
    }

    /// @dev V = lockedBTC * P_BTC * D_btc (§9.3). `locked.amount` is 18-decimal BTC (Mezo's gas
    ///      token and veBTC's underlying are both 18-decimal, §6.1).
    function collateralValueUSD(uint256 tokenId) external view returns (uint256) {
        IVotingEscrow.LockedBalance memory lb = IVotingEscrow(escrowTokenAddr).locked(tokenId);
        if (lb.amount <= 0) return 0;
        uint256 lockedBtc = uint256(uint128(lb.amount));
        (uint256 priceUsd, bool stale) = oracleRouter.getPriceUSD(btcPriceToken);
        if (stale) return 0;
        uint256 v = (lockedBtc * priceUsd) / WAD;
        return (v * DISCOUNT_BPS) / BPS;
    }
}
