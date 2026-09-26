// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ReserveFund
/// @notice First-loss buffer funded by protocol fees (Harvester) and liquidation penalties
///         (DutchAuctionLiquidator). Backstops auctions with no bids at the floor. See docs §11.2, §16 threat #10.
contract ReserveFund is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable musd;
    address public liquidator;

    event LiquidatorSet(address indexed liquidator);
    event WithdrawnTo(address indexed to, uint256 amount);

    error NotLiquidator();

    constructor(address initialOwner, address _musd) Ownable(initialOwner) {
        musd = IERC20(_musd);
    }

    modifier onlyLiquidator() {
        if (msg.sender != liquidator) revert NotLiquidator();
        _;
    }

    function setLiquidator(address _liquidator) external onlyOwner {
        liquidator = _liquidator;
        emit LiquidatorSet(_liquidator);
    }

    function withdrawTo(address to, uint256 amount) external onlyLiquidator {
        musd.safeTransfer(to, amount);
        emit WithdrawnTo(to, amount);
    }

    function balance() external view returns (uint256) {
        return musd.balanceOf(address(this));
    }
}
