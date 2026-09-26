import type { Abi } from "viem";
import LoanManagerAbi from "./abis/LoanManager.json" with { type: "json" };
import HarvesterAbi from "./abis/Harvester.json" with { type: "json" };
import DutchAuctionLiquidatorAbi from "./abis/DutchAuctionLiquidator.json" with { type: "json" };

// JSON imports widen `type: "function"` to `string`, which viem's Abi type rejects; assert once here.
export const loanManagerAbi = LoanManagerAbi as Abi;
export const harvesterAbi = HarvesterAbi as Abi;
export const dutchAuctionLiquidatorAbi = DutchAuctionLiquidatorAbi as Abi;
