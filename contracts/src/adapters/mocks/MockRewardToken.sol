// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Freely-mintable ERC20 standing in for a bribe/fee reward token in demos and tests.
contract MockRewardToken is ERC20, Ownable {
    constructor(string memory name_, string memory symbol_, address initialOwner)
        ERC20(name_, symbol_)
        Ownable(initialOwner)
    { }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
