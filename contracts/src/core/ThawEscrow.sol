// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IThawEscrow } from "../interfaces/IThawEscrow.sol";

/// @title ThawEscrow
/// @notice Custodies borrower veNFTs. Never holds MUSD or takes on debt logic itself.
///         Two privilege tiers, per docs/THAW_SYSTEM_DESIGN.md §7.2 and §16 (threat #1, #7):
///           - CONTROLLER (LoanManager, Liquidator): may pull/release the NFT itself.
///           - EXECUTOR (registered adapters): may forward an arbitrary call *as the escrow*
///             to an allowlisted target only (the veNFT contract or its Voter), so an adapter
///             can vote/claim on behalf of the NFT the escrow owns without ever being able to
///             move the NFT out or touch unrelated contracts.
contract ThawEscrow is IThawEscrow, Ownable {
    using SafeERC20 for IERC20;

    address public loanManager;
    address public liquidator;
    address public harvester;

    mapping(address => bool) public isAdapter;
    mapping(address => bool) public allowedTarget;
    mapping(bytes32 => bool) private _held; // keccak256(collection, tokenId) => held

    event LoanManagerSet(address indexed loanManager);
    event LiquidatorSet(address indexed liquidator);
    event HarvesterSet(address indexed harvester);
    event AdapterSet(address indexed adapter, bool enabled);
    event AllowedTargetSet(address indexed target, bool allowed);
    event Pulled(address indexed collection, address indexed from, uint256 indexed tokenId);
    event Released(address indexed collection, address indexed to, uint256 indexed tokenId);
    event Executed(address indexed adapter, address indexed target);
    event Swept(address indexed token, address indexed to, uint256 amount);

    error NotController();
    error NotAdapter();
    error TargetNotAllowed();
    error NotHeld();

    constructor(address initialOwner) Ownable(initialOwner) { }

    modifier onlyController() {
        if (msg.sender != loanManager && msg.sender != liquidator) revert NotController();
        _;
    }

    modifier onlyAdapter() {
        if (!isAdapter[msg.sender]) revert NotAdapter();
        _;
    }

    // --- wiring (governance) ---

    function setLoanManager(address _loanManager) external onlyOwner {
        loanManager = _loanManager;
        emit LoanManagerSet(_loanManager);
    }

    function setLiquidator(address _liquidator) external onlyOwner {
        liquidator = _liquidator;
        emit LiquidatorSet(_liquidator);
    }

    function setHarvester(address _harvester) external onlyOwner {
        harvester = _harvester;
        emit HarvesterSet(_harvester);
    }

    function setAdapter(address adapter, bool enabled) external onlyOwner {
        isAdapter[adapter] = enabled;
        emit AdapterSet(adapter, enabled);
    }

    function setAllowedTarget(address target, bool allowed) external onlyOwner {
        allowedTarget[target] = allowed;
        emit AllowedTargetSet(target, allowed);
    }

    // --- custody ---

    function pull(address collection, address from, uint256 tokenId) external onlyController {
        IERC721(collection).transferFrom(from, address(this), tokenId);
        _held[_key(collection, tokenId)] = true;
        emit Pulled(collection, from, tokenId);
    }

    function release(address collection, address to, uint256 tokenId) external onlyController {
        bytes32 key = _key(collection, tokenId);
        if (!_held[key]) revert NotHeld();
        _held[key] = false;
        IERC721(collection).transferFrom(address(this), to, tokenId);
        emit Released(collection, to, tokenId);
    }

    function isHeld(address collection, uint256 tokenId) external view returns (bool) {
        return _held[_key(collection, tokenId)];
    }

    // --- adapter passthrough (vote / claim on the veNFT the escrow owns) ---

    function execute(address target, bytes calldata data) external onlyAdapter returns (bytes memory) {
        if (!allowedTarget[target]) revert TargetNotAllowed();
        emit Executed(msg.sender, target);
        (bool ok, bytes memory ret) = target.call(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }

    /// @notice Moves reward tokens claimed into the escrow (via `execute`) out to the caller adapter's
    ///         chosen recipient. Only reachable through an adapter, and only after that adapter itself
    ///         gated the call to the Harvester (see BaseVeAdapter.onlyHarvester).
    function sweepERC20(address token, uint256 amount, address to) external onlyAdapter {
        IERC20(token).safeTransfer(to, amount);
        emit Swept(token, to, amount);
    }

    function _key(address collection, uint256 tokenId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(collection, tokenId));
    }
}
