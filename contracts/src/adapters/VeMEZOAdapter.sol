// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { SolidlyVeAdapter } from "./SolidlyVeAdapter.sol";
import { BaseVeAdapter } from "./BaseVeAdapter.sol";
import { IVotingEscrow } from "../interfaces/IVotingEscrow.sol";
import { IOracleRouter } from "../interfaces/IOracleRouter.sol";

/// @title VeMEZOAdapter
/// @notice Adapter over veMEZO + its boost-voter (§6.2 flags this contract as unconfirmed on
///         testnet — wire the real address once the Mezo team confirms it; until then this adapter
///         can point at a self-deployed tigris VeMEZO fork, per the §22/§23 fallback plan).
contract VeMEZOAdapter is SolidlyVeAdapter {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 1e4;
    uint256 internal constant YEAR = 365 days;

    uint256 internal constant DISCOUNT_LONG_BPS = 5000; // permanent / >3y: 0.50
    uint256 internal constant DISCOUNT_MID_BPS = 6000; // 1-3y: 0.60
    uint256 internal constant DISCOUNT_SHORT_FLOOR_BPS = 6000; // <1y floor
    uint256 internal constant DISCOUNT_SHORT_RANGE_BPS = 4000; // <1y: floor + range * elapsed/1y

    IOracleRouter public oracleRouter;
    address public mezoPriceToken;

    constructor(
        address initialOwner,
        address _veMEZO,
        address _thawEscrow,
        address _voter,
        address _oracleRouter,
        address _mezoPriceToken
    ) BaseVeAdapter(initialOwner, _veMEZO, _thawEscrow) SolidlyVeAdapter(_voter) {
        oracleRouter = IOracleRouter(_oracleRouter);
        mezoPriceToken = _mezoPriceToken;
    }

    function setOracleRouter(address _oracleRouter) external onlyOwner {
        oracleRouter = IOracleRouter(_oracleRouter);
    }

    function setMezoPriceToken(address token) external onlyOwner {
        mezoPriceToken = token;
    }

    /// @dev V = lockedAmount * P_MEZO * D(t) (§9.3).
    function collateralValueUSD(uint256 tokenId) external view returns (uint256) {
        IVotingEscrow.LockedBalance memory lb = IVotingEscrow(escrowTokenAddr).locked(tokenId);
        if (lb.amount <= 0) return 0;
        uint256 lockedMezo = uint256(uint128(lb.amount));

        (uint256 priceUsd, bool stale) = oracleRouter.getPriceUSD(mezoPriceToken);
        if (stale) return 0;

        uint256 discountBps = _timeDiscountBps(lb);
        uint256 v = (lockedMezo * priceUsd) / WAD;
        return (v * discountBps) / BPS;
    }

    function _timeDiscountBps(IVotingEscrow.LockedBalance memory lb) internal view returns (uint256) {
        if (lb.isPermanent) return DISCOUNT_LONG_BPS;
        if (lb.end <= block.timestamp) return BPS; // already unlockable: no discount
        uint256 remaining = lb.end - block.timestamp;
        if (remaining > 3 * YEAR) return DISCOUNT_LONG_BPS;
        if (remaining > YEAR) return DISCOUNT_MID_BPS;
        // <1y: converges from 0.60 at 1y-remaining to 1.00 at unlock, §9.3.
        uint256 elapsedShare = ((YEAR - remaining) * BPS) / YEAR; // 0 at 1y remaining -> 1e4 at unlock
        return DISCOUNT_SHORT_FLOOR_BPS + (DISCOUNT_SHORT_RANGE_BPS * elapsedShare) / BPS;
    }
}
