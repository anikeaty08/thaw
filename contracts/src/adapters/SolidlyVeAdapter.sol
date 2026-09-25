// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { BaseVeAdapter } from "./BaseVeAdapter.sol";
import { IVotingEscrow } from "../interfaces/IVotingEscrow.sol";
import { IVoter } from "../interfaces/IVoter.sol";
import { IReward } from "../interfaces/IReward.sol";

/// @title SolidlyVeAdapter
/// @notice Generic vote/claim implementation shared by any Solidly/Velodrome-v2-style ve system
///         on Mezo (both veBTC and veMEZO share this shape per tigris, docs §6.2-§6.3). Concrete
///         adapters only need to supply `collateralValueUSD`.
abstract contract SolidlyVeAdapter is BaseVeAdapter {
    IVoter public voter;

    mapping(uint256 => address[]) internal _lastVotedGauges;

    event Registered(uint256 indexed tokenId, address[] gauges);

    error NoVoter();
    error BadStrategy();

    constructor(address _voter) {
        voter = IVoter(_voter);
    }

    function setVoter(address _voter) external onlyOwner {
        voter = IVoter(_voter);
    }

    function vote(uint256 tokenId, bytes calldata strategy) external onlyHarvester {
        if (address(voter) == address(0)) revert NoVoter();
        if (strategy.length == 0) return; // no strategy registered yet; skip this epoch's vote

        (address[] memory gauges, uint256[] memory weights) = abi.decode(strategy, (address[], uint256[]));
        if (gauges.length == 0 || gauges.length != weights.length) revert BadStrategy();

        _execute(address(voter), abi.encodeCall(IVoter.vote, (tokenId, gauges, weights)));
        _lastVotedGauges[tokenId] = gauges;
        emit Registered(tokenId, gauges);
    }

    function claim(uint256 tokenId) external onlyHarvester returns (address[] memory tokens, uint256[] memory amounts) {
        address[] memory gauges = _lastVotedGauges[tokenId];
        if (gauges.length == 0) {
            return (new address[](0), new uint256[](0));
        }

        (
            address[] memory bribeContracts,
            address[] memory feeContracts,
            address[][] memory bribeTokens,
            address[][] memory feeTokens,
            address[] memory allTokens
        ) = _buildClaimPlan(gauges);

        uint256[] memory before = new uint256[](allTokens.length);
        for (uint256 i = 0; i < allTokens.length; i++) {
            before[i] = IERC20(allTokens[i]).balanceOf(address(thawEscrow));
        }

        if (bribeContracts.length > 0) {
            _execute(address(voter), abi.encodeCall(IVoter.claimBribes, (bribeContracts, bribeTokens, tokenId)));
        }
        if (feeContracts.length > 0) {
            _execute(address(voter), abi.encodeCall(IVoter.claimFees, (feeContracts, feeTokens, tokenId)));
        }

        tokens = allTokens;
        amounts = new uint256[](allTokens.length);
        for (uint256 i = 0; i < allTokens.length; i++) {
            uint256 nowBal = IERC20(allTokens[i]).balanceOf(address(thawEscrow));
            uint256 delta = nowBal > before[i] ? nowBal - before[i] : 0;
            amounts[i] = delta;
            if (delta > 0) {
                _sweep(allTokens[i], delta, msg.sender);
            }
        }
    }

    function pendingRewards(uint256 tokenId) external view returns (address[] memory tokens, uint256[] memory amounts) {
        address[] memory gauges = _lastVotedGauges[tokenId];
        if (gauges.length == 0 || address(voter) == address(0)) {
            return (new address[](0), new uint256[](0));
        }
        (address[] memory bribeContracts,,,, address[] memory allTokens) = _buildClaimPlan(gauges);
        tokens = allTokens;
        amounts = new uint256[](allTokens.length);
        for (uint256 i = 0; i < allTokens.length; i++) {
            uint256 sum;
            for (uint256 g = 0; g < bribeContracts.length; g++) {
                if (bribeContracts[g] == address(0)) continue;
                sum += IReward(bribeContracts[g]).earned(allTokens[i], tokenId);
            }
            amounts[i] = sum;
        }
    }

    function unlockTime(uint256 tokenId) external view returns (uint256) {
        IVotingEscrow.LockedBalance memory lb = IVotingEscrow(escrowTokenAddr).locked(tokenId);
        return lb.isPermanent ? type(uint256).max : lb.end;
    }

    function canRelease(uint256 tokenId) external view returns (bool) {
        if (IVotingEscrow(escrowTokenAddr).deactivated(tokenId)) return false;
        return !IVotingEscrow(escrowTokenAddr).voted(tokenId);
    }

    function prepareRelease(uint256 tokenId) external onlyLoanManager {
        if (address(voter) != address(0) && IVotingEscrow(escrowTokenAddr).voted(tokenId)) {
            _execute(address(voter), abi.encodeCall(IVoter.reset, (tokenId)));
        }
    }

    function _buildClaimPlan(address[] memory gauges)
        internal
        view
        returns (
            address[] memory bribeContracts,
            address[] memory feeContracts,
            address[][] memory bribeTokens,
            address[][] memory feeTokens,
            address[] memory allTokens
        )
    {
        bribeContracts = new address[](gauges.length);
        feeContracts = new address[](gauges.length);
        bribeTokens = new address[][](gauges.length);
        feeTokens = new address[][](gauges.length);

        address[] memory scratch = new address[](gauges.length * 8);
        uint256 count;

        for (uint256 i = 0; i < gauges.length; i++) {
            address bribe = voter.gaugeToBribe(gauges[i]);
            address fee = voter.gaugeToFees(gauges[i]);
            bribeContracts[i] = bribe;
            feeContracts[i] = fee;

            bribeTokens[i] = _rewardTokenList(bribe);
            for (uint256 j = 0; j < bribeTokens[i].length; j++) {
                count = _addUnique(scratch, count, bribeTokens[i][j]);
            }
            feeTokens[i] = _rewardTokenList(fee);
            for (uint256 j = 0; j < feeTokens[i].length; j++) {
                count = _addUnique(scratch, count, feeTokens[i][j]);
            }
        }

        allTokens = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            allTokens[i] = scratch[i];
        }
    }

    function _rewardTokenList(address rewardContract) internal view returns (address[] memory list) {
        if (rewardContract == address(0)) return new address[](0);
        uint256 len = IReward(rewardContract).rewardsListLength();
        list = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            list[i] = IReward(rewardContract).rewards(i);
        }
    }

    function _addUnique(address[] memory arr, uint256 count, address token) internal pure returns (uint256) {
        for (uint256 i = 0; i < count; i++) {
            if (arr[i] == token) return count;
        }
        arr[count] = token;
        return count + 1;
    }
}
