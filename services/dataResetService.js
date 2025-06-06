import mongoose from "mongoose";
import { WeekDaysEnums } from "../constants/constants.js";
import { Biding } from "../models/bidModel.js";
import { Game, GameTimings } from "../models/gameModel.js";
import { HistoryData, Transaction, UserHistoryData } from "../models/transModel.js";
import { User } from "../models/userModel.js";
import { ApiError } from "../utils/ApiError.js";



/// Reset All Bazaar Game Timings & Game Status  ( 12:30 AM )
// export async function resetAllBazaarGameTimings() {
//     const currentDayName = WeekDaysEnums[new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()];

//     try {
//         const filter = { gameDay: currentDayName };

//         const gameTimings = await GameTimings.find(filter);

//         for (const gameTiming of gameTimings) {
//             const update = {
//                 $set: {
//                     // isGameActive: gameTiming.isOpen
//                 }
//             };
//             const update1 = {
//                 $set: {
//                     openBidTime: new Date(
//                         new Date().toDateString() + " " + new Date(gameTiming.openBidTime).toTimeString().slice(0, 8)
//                     ).toISOString(),
//                     closeBidTime: new Date(
//                         new Date().toDateString() + " " + new Date(gameTiming.closeBidTime).toTimeString().slice(0, 8)
//                     ).toISOString(),
//                     openBidResultTime: new Date(
//                         new Date().toDateString() +
//                         " " +
//                         new Date(gameTiming.openBidResultTime).toTimeString().slice(0, 8)
//                     ).toISOString(),
//                     closeBidResultTime: new Date(
//                         new Date().toDateString() +
//                         " " +
//                         new Date(gameTiming.closeBidResultTime).toTimeString().slice(0, 8)
//                     ).toISOString()
//                 }
//             };
//             const options = { new: true };

//             await Game.findByIdAndUpdate(gameTiming.gameId, update, options);
//             await GameTimings.findByIdAndUpdate(gameTiming._id, update1, options);
//         }
//     } catch (error) {
//         console.error("Error :", error);
//     }
// }


// Reset Every Bazaar Results ( 01:00 AM )
export async function resetFinalAnk() {
    const currentDayName = WeekDaysEnums[new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()];

    try {
        const filter = { gameDay: currentDayName };

        const gameTimings = await GameTimings.find(filter, { gameId: 1 });

        const gameIdList = gameTimings.map((element) => element.gameId);

        const update = {
            $set: {
                guessingNumber: null,
            }
        };

        const options = { new: true };

        // Update all Game documents in a single query
        const updateResult = await Game.updateMany({ _id: { $in: gameIdList } }, update, options);

        console.log(`Updated ${updateResult.modifiedCount} games.`);

    } catch (error) {
        console.error("Error :", error);
    }
}


// Reset Every Bazaar Results ( 08:00 AM )
export async function resetEveryBazaarResults() {
    const currentDayName = WeekDaysEnums[new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()];

    try {
        const filter = { gameDay: currentDayName, gameCategory: { $in: ["QUICK DHAN LAXMI", "QUICK MAHA LAXMI", "DAY GAME"] } };

        const gameTimings = await GameTimings.find(filter, { gameId: 1 });

        const gameIdList = gameTimings.map((element) => element.gameId);

        const update = {
            $set: {
                openNumber: null,
                closeNumber: null,
                resultNumber: null,
                // guessingNumber: null,
                resultDeclareDate: null
            }
        };

        const options = { new: true };

        // Update all Game documents in a single query
        const updateResult = await Game.updateMany({ _id: { $in: gameIdList } }, update, options);

        console.log(`Updated ${updateResult.modifiedCount} games.`);

    } catch (error) {
        console.error("Error :", error);
    }
}



// Reset every data [ CURRENT WALLET = YESTERDAY BALANCE ] ( 12:30 AM )
export async function resetHistoryData() {

    try {

        const user = await User.aggregate([
            {
                $match: { isBlocked: false }
            },
            {
                $group: {
                    _id: null,
                    totalWalletAmount: {
                        $sum: "$walletAmount",
                    },
                }
            }

        ]);
        await HistoryData.create({ walletAmount: user[0].totalWalletAmount })

    } catch (error) {
        console.error('', error);
    }

};


// Generate User History
export async function generateUserHistory() {
    let filter = {};

    let date = new Date().toJSON();
    let todayDate = date.split("T")[0];

    filter.createdAt = { $gte: new Date(`${todayDate}T00:00:00.000Z`), $lte: new Date(`${todayDate}T23:59:59.999Z`) };


    try {

        const totalTransactions = await Transaction.aggregate([
            {
                $match: filter
            },
            { $group: { _id: "$userId", data: { $push: "$$ROOT", } } },
            { $project: { _id: 0, userId: "$_id", allData: "$data" } },
            { $unwind: "$allData" },
            {
                $group: {
                    _id: {
                        userId: "$userId",
                        transactionType:
                            "$allData.transactionType",
                        addedBy:
                            "$allData.addedBy",
                        paymentFor:
                            "$allData.paymentFor",
                    },
                    data: { $push: "$allData" },
                },
            },
            {
                $project: {
                    _id: 0,
                    userId: "$_id.userId",
                    transactionType: "$_id.transactionType",
                    addedBy: "$_id.addedBy",
                    paymentFor: "$_id.paymentFor",
                    dataLength: { $size: "$data" },
                    allData: "$data",
                },
            },
            {
                $addFields: {
                    allData: {
                        $map: {
                            input: "$allData",
                            as: "data",
                            in: {
                                userId: "$userId",
                                transactionType: "$transactionType",
                                addedBy: "$addedBy",
                                paymentFor: "$paymentFor",
                                transactionAmount:
                                    "$$data.transactionAmount",
                            },
                        },
                    },
                },
            },
            { $unwind: "$allData" },
            {
                $group: {
                    _id: {
                        userId: "$allData.userId",
                        transactionType: "$allData.transactionType",
                        addedBy: "$allData.addedBy",
                        paymentFor: "$allData.paymentFor",
                    },
                    totalTransactionAmount: {
                        $sum: "$allData.transactionAmount",
                    }
                },
            },
            {
                $project: {
                    _id: 0,
                    userId: "$_id.userId",
                    transactionType: "$_id.transactionType",
                    addedBy: "$_id.addedBy",
                    paymentFor: "$_id.paymentFor",
                    totalTransactionAmount: 1,
                },
            },
            {
                $addFields: {
                    transactionDebitAmount: {
                        $sum: {
                            $map: {
                                input: ["$$ROOT"],
                                as: "detail",
                                in: {
                                    $cond: {
                                        if: {
                                            $and: [
                                                { $eq: ["$$detail.transactionType", "DEBIT"] },
                                                // { $eq: ["$$detail.addedBy", "self"] },
                                                // { $eq: ["$$detail.paymentFor", "fund"] },
                                            ],
                                        },
                                        then: "$$detail.totalTransactionAmount",
                                        else: 0,
                                    },
                                },
                            },
                        },
                    },
                    transactionCreditAmount: {
                        $sum: {
                            $map: {
                                input: ["$$ROOT"],
                                as: "detail",
                                in: {
                                    $cond: {
                                        if: {
                                            $eq: [
                                                "$$detail.transactionType",
                                                "CREDIT",
                                            ],
                                        },
                                        then: "$$detail.totalTransactionAmount",
                                        else: 0,
                                    },
                                },
                            },
                        },
                    },
                    transactionWithdrawalAmount: {
                        $sum: {
                            $map: {
                                input: ["$$ROOT"],
                                as: "detail",
                                in: {
                                    $cond: {
                                        if: {
                                            $eq: [
                                                "$$detail.transactionType",
                                                "WITHDRAW",
                                            ],
                                        },
                                        then: "$$detail.totalTransactionAmount",
                                        else: 0,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            {
                $project: {
                    totalTransactionAmount: 1,
                    userId: 1,
                    transactionType: 1,
                    transactionDebitAmount: 1,
                    transactionCreditAmount: 1,
                    transactionWithdrawalAmount: 1,
                    addedBy: 1,
                    paymentFor: 1,
                },
            },
            {
                $group: {
                    _id: "$userId",
                    transactionDebitAmount: {
                        $sum: "$transactionDebitAmount",
                    },
                    transactionCreditAmount: {
                        $sum: "$transactionCreditAmount",
                    },
                    transactionWithdrawalAmount: {
                        $sum: "$transactionWithdrawalAmount",
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    userId: "$_id",
                    transactionDebitAmount: 1,
                    transactionCreditAmount: 1,
                    transactionWithdrawalAmount: 1,
                },
            },
            {
                $lookup: {
                    from: "bidings",
                    localField: "userId",
                    foreignField: "userId",
                    as: "bidingsResult",
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "result",
                },
            },
            {
                $unwind: "$bidingsResult"
            },
            {
                $match: { "bidingsResult.createdAt": { $gte: new Date(`${todayDate}T00:00:00.000Z`), $lte: new Date(`${todayDate}T23:59:59.999Z`) } }
            },
            {
                $group: {
                    _id: "$userId",
                    username: {
                        $first: { $arrayElemAt: ["$result.username", 0] },
                    },
                    name: {
                        $first: { $arrayElemAt: ["$result.name", 0] }
                    },
                    mobile: {
                        $first: { $arrayElemAt: ["$result.mobile", 0] }
                    },
                    currentWalletAmount: {
                        $first: { $arrayElemAt: ["$result.walletAmount", 0] }
                    },
                    transactionBidAmount: {
                        $sum: "$bidingsResult.gameAmount",
                    },
                    transactionWinAmount: {
                        $sum: "$bidingsResult.winAmount",
                    },
                    transactionDebitAmount: {
                        $first: "$transactionDebitAmount",
                    },
                    transactionCreditAmount: {
                        $first: "$transactionCreditAmount",
                    },
                    transactionWithdrawalAmount: {
                        $first: "$transactionWithdrawalAmount",
                    },
                },
            }

        ]);

        const userList = await User.find({}, { _id: 1, walletAmount: 1 });


        for (let user of userList) {
            let foundMatch = false;

            for (let transaction of totalTransactions) {
                if (transaction["_id"].equals(user["_id"])) {
                    console.log("If Match");
                    console.log(transaction["currentWalletAmount"]);

                    await UserHistoryData.create({
                        userId: user["_id"],
                        walletAmount: transaction["currentWalletAmount"],
                        bidAmount: transaction["transactionBidAmount"],
                        winAmount: transaction["transactionWinAmount"],
                        transactionDebitAmount: transaction["transactionDebitAmount"],
                        dipositAmount: transaction["transactionCreditAmount"],
                        withdrawalAmount: transaction["transactionWithdrawalAmount"]
                    });

                    foundMatch = true;
                    break; // No need to check further transactions for this user
                }
            }

            if (!foundMatch) {
                console.log("If Not Match");
                await UserHistoryData.create({
                    userId: user["_id"],
                    walletAmount: user["walletAmount"],
                    bidAmount: 0,
                    winAmount: 0,
                    transactionDebitAmount: 0,
                    dipositAmount: 0,
                    withdrawalAmount: 0
                });
            }
        }

    } catch (error) {

        console.log(error);

        throw new ApiError(500, error)
    }

}

// Reset Web Timing & result 
export async function resetWebTimingAndResult() {
    const currentDayName = WeekDaysEnums[new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()];

    try {
        const filter = { gameDay: currentDayName };

        const gameTimings = await GameTimings.find(filter, { gameId: 1, openBidResultTime: 1, closeBidResultTime: 1 });

        gameTimings.map(async (element) => {

            const game = await Game.findById(element.gameId);


            // console.log(element);
            const update = {
                $set: {
                    openWebResultTime: element.openBidResultTime,
                    closeWebResultTime: element.closeBidResultTime,
                    lastOpenNumber: game.openNumber,
                    lastCloseNumber: game.closeNumber,
                    lastResultNumber: game.resultNumber
                }
            };

            const options = { new: true };


            // Update all Game documents in a single query
            const updateResult = await Game.findOneAndUpdate({ _id: element.gameId }, update, options);

            console.log(`Updated ${updateResult} games.`);

        });



    } catch (error) {
        console.error("Error :", error);
    }
}