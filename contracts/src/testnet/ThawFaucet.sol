// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MockVotingEscrow } from "../adapters/mocks/MockVotingEscrow.sol";
import { MockVeAdapter } from "../adapters/MockVeAdapter.sol";

/// @title ThawFaucet
/// @notice Testnet-only: lets any wallet try Thaw end to end. One `drip()` sends test MUSD and mints a
///         demo veNFT whose mock rewards and value are preset, so it can be borrowed against at once.
/// @dev Must own the MockVotingEscrow (to mint) and the MockVeAdapter (to set rewards). MUSD comes
///      from a pre-funded balance, since mock MUSD minting belongs to the adapter. `execute` keeps the
///      owner able to administer the contracts this faucet now owns.
contract ThawFaucet is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable musd;
    MockVotingEscrow public immutable ve;
    MockVeAdapter public immutable adapter;

    uint256 public musdPerDrip = 1_000e18;
    uint256 public lockAmount = 1_000e18;
    uint256 public weeklyReward = 60e18;
    uint256 public collateralValue = 5_000e18;
    uint256 public cooldown = 1 days;

    mapping(address => uint256) public lastDripAt;

    event Dripped(address indexed to, uint256 indexed tokenId, uint256 musdAmount);
    event DripConfigSet(uint256 musdPerDrip, uint256 weeklyReward, uint256 collateralValue, uint256 cooldown);

    error CoolingDown(uint256 availableAt);
    error CallFailed(bytes reason);

    constructor(address initialOwner, IERC20 _musd, MockVotingEscrow _ve, MockVeAdapter _adapter)
        Ownable(initialOwner)
    {
        musd = _musd;
        ve = _ve;
        adapter = _adapter;
    }

    /// @notice Timestamp from which `account` may drip again (0 = now).
    function nextDripAt(address account) public view returns (uint256) {
        uint256 last = lastDripAt[account];
        return last == 0 ? 0 : last + cooldown;
    }

    function drip() external returns (uint256 tokenId) {
        uint256 availableAt = nextDripAt(msg.sender);
        if (block.timestamp < availableAt) revert CoolingDown(availableAt);
        lastDripAt[msg.sender] = block.timestamp;

        tokenId = ve.mint(msg.sender, lockAmount, block.timestamp + 730 days, false);
        adapter.setWeeklyReward(tokenId, weeklyReward);
        adapter.setCollateralValue(tokenId, collateralValue);

        uint256 amount = musdPerDrip;
        uint256 balance = musd.balanceOf(address(this));
        if (amount > balance) amount = balance; // still hand out the lock if MUSD runs dry
        if (amount > 0) musd.safeTransfer(msg.sender, amount);

        emit Dripped(msg.sender, tokenId, amount);
    }

    function setDripConfig(uint256 _musdPerDrip, uint256 _weeklyReward, uint256 _collateralValue, uint256 _cooldown)
        external
        onlyOwner
    {
        musdPerDrip = _musdPerDrip;
        weeklyReward = _weeklyReward;
        collateralValue = _collateralValue;
        cooldown = _cooldown;
        emit DripConfigSet(_musdPerDrip, _weeklyReward, _collateralValue, _cooldown);
    }

    /// @notice Owner passthrough, e.g. `adapter.setHarvester` or `ve.transferOwnership` back out.
    function execute(address target, bytes calldata data) external onlyOwner returns (bytes memory result) {
        bool ok;
        (ok, result) = target.call(data);
        if (!ok) revert CallFailed(result);
    }
}
