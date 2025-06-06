import { HistoryData, Transaction, UpiData, UserHistoryData } from "../models/transModel.js";
import { TransactionPaymentEnums, TransactionTypeEnums, WeekDaysEnums } from "../constants/constants.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Admin, User } from "../models/userModel.js";
import mongoose from "mongoose";
import { WithdrawSetting } from "../models/settingModel.js";
import { Biding } from "../models/bidModel.js";
import { sendNotifcationWithFirebase } from "../utils/notifications.js";

/// Get User Total Fund History
export const getTotalFundHistory = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { transactionType, transactionStatus, isGameHistory, paymentFor, limit = 1000, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    let filter = {
        userId: new mongoose.Types.ObjectId(userId)
    };

    if (transactionType) {
        filter.transactionType = Array.isArray(transactionType) ? { $in: transactionType } : transactionType;
    }
    if (paymentFor) {
        filter.paymentFor = Array.isArray(paymentFor) ? { $in: paymentFor } : paymentFor;
    }
    if (transactionStatus) {
        filter.transactionStatus = Array.isArray(transactionStatus) ? { $in: transactionStatus } : transactionStatus;
    }

    if (isGameHistory) {
        filter.gameName = { $exists: true };
    }

    try {
        const totalTransactions = await Transaction.aggregate([
            {
                $match: filter
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: parseInt(limit)
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            {
                $unwind: {
                    path: "$userData",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }
        ]);

        let totalAmount = 0;

        totalTransactions.forEach((element) => {
            totalAmount += element["currentAmount"];
        });

        return res.status(200).json(
            new ApiResponse(200, {
                totalTransactions: totalTransactions,
                totalAmount: totalAmount
            })
        );
    } catch (error) {
        console.error("Error fetching fund:", error);
        throw new ApiError(500, "Error fetching fund:" + error);
    }
});

/// Add Fund For User
export const addFundByUser = asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const { upiId, transactionId, transactionAmount, addedFor } = req.body;

    // addedFor -> auto, manual

    try {
        let user = await User.findById(userId);
        if (!user) {
            throw new ApiError(500, "User not found" + error);
        }

        if (addedFor.toLowerCase() == "manual") {
            const newFund = new Transaction({
                userId,
                upiId,
                transactionType: TransactionTypeEnums.CREDIT,
                transactionId,
                transactionStatus: TransactionPaymentEnums.PENDING,
                previousAmount: user.walletAmount,
                transactionAmount,
                // currentAmount: parseFloat(user.walletAmount) + parseFloat(transactionAmount),
                currentAmount: parseFloat(user.walletAmount),
                addedBy: "self",
                paymentFor: "fund",
                description: `Manual Credit ${transactionAmount} `
            });

            // await User.findByIdAndUpdate(userId,
            //     {
            //         $set: {
            //             walletAmount: (parseFloat(user.walletAmount) + parseFloat(transactionAmount))
            //         }
            //     }, { new: true })

            const savedFund = await newFund.save();

            console.log("Fund added successfully:", savedFund);

            return res.status(201).json(new ApiResponse(200, savedFund));
        } else if (addedFor.toLowerCase() == "auto") {
            const newFund = new Transaction({
                userId,
                upiId,
                transactionType: TransactionTypeEnums.CREDIT,
                transactionId,
                transactionStatus: TransactionPaymentEnums.SUCCESS,
                previousAmount: user.walletAmount,
                transactionAmount,
                currentAmount: parseFloat(user.walletAmount) + parseFloat(transactionAmount),
                // currentAmount: parseFloat(user.walletAmount),
                addedBy: "self",
                paymentFor: "fund",
                description: `Self Deposit ${transactionAmount} `
            });

            await User.findByIdAndUpdate(
                userId,
                {
                    $set: {
                        walletAmount: parseFloat(user.walletAmount) + parseFloat(transactionAmount)
                    }
                },
                { new: true }
            );

            const savedFund = await newFund.save();

            console.log("Fund added successfully:", savedFund);

            return res.status(201).json(new ApiResponse(200, savedFund));
        }
    } catch (error) {
        console.error("Error adding fund:", error);
        throw new ApiError(500, "Error adding fund:" + error);
    }
});

/// Withdraw Fund By User
export const withdrawFundByUser = asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const { transactionAmount } = req.body;

    try {
        const currentDate = new Date();

        const currentDayName =
            WeekDaysEnums[currentDate.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()];

        const user = await User.findById(userId);

        const withdrawRequest = await WithdrawSetting.findOne({ withdrawDay: currentDayName });

        let currentTime = new Date(new Date(currentDate).getTime() + 330 * 60000)
            .toJSON()
            .split("T")[1]
            .substring(0, 8);
        let requestOpenTime = withdrawRequest.openWithdrawTime.toJSON().split("T")[1].substring(0, 8);
        let requestCloseTime = withdrawRequest.closeWithdrawTime.toJSON().split("T")[1].substring(0, 8);

        console.log(currentTime);
        console.log(requestOpenTime);
        console.log(requestCloseTime);
        console.log(currentTime < requestOpenTime);
        console.log(currentTime < requestCloseTime);

        // console.log(withdrawRequest);
        if (withdrawRequest.withdrawStatus == false) {
            console.error("Withdrwal request is off ");
            throw new ApiError(500, "Withdrwal request is off ");
        }

        if (currentTime < requestOpenTime || currentTime > requestCloseTime) {
            console.error(`Withdrwal request timing is ${requestOpenTime} to ${requestCloseTime} `);
            throw new ApiError(500, `Withdrwal request timing is ${requestOpenTime} to ${requestCloseTime} `);
        }
        // /// Fetch All the pending request
        const userPendingTransactions = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    transactionStatus: "PENDING"
                }
            },
            {
                $facet: {
                    totalPendingAmount: [
                        {
                            $group: {
                                _id: null,
                                total: {
                                    $sum: "$transactionAmount"
                                }
                            }
                        }
                    ],
                    count: [
                        {
                            $count: "count"
                        }
                    ]
                }
            },
            {
                $project: {
                    totalPendingAmount: {
                        $ifNull: [{ $arrayElemAt: ["$totalPendingAmount.total", 0] }, 0]
                    }
                }
            }
        ]);

        const userDetails = await User.findById(userId, { walletAmount: 1 });

        // console.log(userDetails.walletAmount);
        // console.log(userPendingTransactions[0]["totalPendingAmount"]);

        const finalAmount =
            parseFloat(userDetails.walletAmount) - parseFloat(userPendingTransactions[0]["totalPendingAmount"]);

        // console.log(finalAmount);

        if (finalAmount >= transactionAmount) {
            // Create a new transaction instance
            const newFund = new Transaction({
                userId,
                transactionType: TransactionTypeEnums.WITHDRAW,
                transactionId: Date.now(),
                transactionStatus: TransactionPaymentEnums.PENDING,
                previousAmount: parseFloat(user.walletAmount),
                transactionAmount,
                currentAmount: parseFloat(user.walletAmount),
                addedBy: "self",
                paymentFor: "fund",
                description: `Self Withdrawal ${transactionAmount}`
            });

            // Save the fund to the database
            const savedFund = await newFund.save();

            // console.log('Fund withdraw successfully:', savedFund);

            return res.status(201).json(new ApiResponse(200, savedFund));
        } else {
            throw new ApiError(200, "Your withdrawal request is currently under review");
        }
    } catch (error) {
        console.error("", error);
        throw new ApiError(500, "" + error);
    }
});

/// Update User Withdrawal By Admin
export const updateUserWithdrawal = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { transactionType, transactionAmount, description, addedBy } = req.body;

    try {
        const user = await User.findById(id);

        if (user == null) {
            console.error("User not found");
            throw new ApiError(500, "User not found");
        }

        const tempTransType = transactionType.toUpperCase();

        if (tempTransType == "DEBIT" && parseFloat(user.walletAmount) < parseFloat(transactionAmount)) {
            console.error("Wallet amount is low ");
            throw new ApiError(500, "Wallet amount is low ");
        }

        /// MANAGE TRANSACTION
        await Transaction.create({
            userId: id,
            transactionId: `${Date.now()}`,
            transactionType: tempTransType,
            transactionStatus: TransactionPaymentEnums.SUCCESS,
            previousAmount: user.walletAmount,
            transactionAmount: transactionAmount,
            currentAmount:
                transactionType == "DEBIT"
                    ? parseFloat(user.walletAmount) - parseFloat(transactionAmount)
                    : parseFloat(user.walletAmount) + parseFloat(transactionAmount),
            description: description,
            addedBy: addedBy,
            paymentFor: "fund"
        });

        /// UPDATE WALLET
        const updatedUser = await User.findByIdAndUpdate(
            id,
            {
                walletAmount:
                    transactionType == "DEBIT"
                        ? parseFloat(user.walletAmount) - parseFloat(transactionAmount)
                        : parseFloat(user.walletAmount) + parseFloat(transactionAmount)
            },
            { new: true }
        );

        if (user.fcmToken != undefined && user.isMainNotificationOn != undefined && user.isMainNotificationOn == true) {
            sendNotifcationWithFirebase(user.fcmToken, {
                title: `🎉🎉🎉 ${transactionType == "DEBIT" ? "" : "Congratulations"} 🎉🎉🎉`,
                body: `Hello ${user.name} Rs. ${transactionAmount} have been ${
                    transactionType == "DEBIT" ? "debited from" : "credited to"
                }  your wallet by admin. `
            });
        }

        return res.status(201).json(new ApiResponse(200, updatedUser));
    } catch (error) {
        console.error("Something went wrong :", error);
        throw new ApiError(500, "Something went wrong :" + error);
    }
});

/// Get Total transactions
export const getTotalTransactions = asyncHandler(async (req, res) => {
    const {
        transactionType,
        transactionStatus,
        addedBy,
        upiId,
        paymentFor,
        username,
        startDate,
        endDate,
        limit = 1000,
        page = 1
    } = req.query;

    const skip = (page - 1) * limit;

    let filter = {};

    if (transactionType) {
        filter.transactionType = Array.isArray(transactionType) ? { $in: transactionType } : transactionType;
    }

    if (transactionStatus) {
        filter.transactionStatus = Array.isArray(transactionStatus) ? { $in: transactionStatus } : transactionStatus;
    }
    if (addedBy) {
        filter.addedBy = addedBy;
    }
    if (upiId) {
        filter.upiId = upiId;
    }
    if (paymentFor) {
        filter.paymentFor = paymentFor;
    }
    if (username) {
        const user = await User.findOne({ username });
        filter.userId = user._id;
    }
    // date range filter
    if (startDate && endDate) {
        filter.createdAt = { $gte: new Date(`${startDate}T00:00:00.000Z`), $lte: new Date(`${endDate}T23:59:59.999Z`) };
    }

    try {
        const totalTransactions = await Transaction.aggregate([
            {
                $match: filter
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: parseInt(limit)
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            {
                $unwind: {
                    path: "$userData",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    "userData.isBlocked": false
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }
        ]);

        let totalAmount = 0;

        totalTransactions.forEach((element) => {
            totalAmount += element["currentAmount"];
        });

        return res.status(200).json(
            new ApiResponse(200, {
                totalTransactions: totalTransactions,
                totalAmount: totalAmount
            })
        );
    } catch (error) {
        console.log(error);

        throw new ApiError(500, error);
    }
});

/// Update Transaction Status
export const updateTransactionStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { transactionPaymentStatus, type } = req.body;
    // type -> withdraw,credit

    const transaction = await Transaction.findById(id);

    if (transaction == null) {
        console.error("Transaction not found ");
        throw new ApiError(500, "Transaction not found ");
    }

    const user = await User.findById(transaction.userId);

    console.log(user.walletAmount);
    console.log(transaction.transactionAmount);

    /// FOR WITHDRAW
    if (type.toLowerCase() == "withdraw") {
        if (transactionPaymentStatus == "APPROVED" && user.walletAmount >= transaction.transactionAmount) {
            /// UPDATE TRANSACTION STATUS
            const updatedTransaction = await Transaction.findByIdAndUpdate(
                id,
                {
                    transactionStatus: transactionPaymentStatus,
                    previousAmount: parseFloat(user.walletAmount),
                    currentAmount: parseFloat(user.walletAmount) - parseFloat(transaction.transactionAmount)
                },
                { new: true }
            );
            console.log(updatedTransaction);
            /// APPROVED/REJECT

            await User.findByIdAndUpdate(
                transaction.userId,

                {
                    walletAmount:
                        transactionPaymentStatus == "APPROVED"
                            ? parseFloat(user.walletAmount) - parseFloat(transaction.transactionAmount)
                            : parseFloat(user.walletAmount) - 0
                },
                { new: true }
            );

            return res.status(200).json(new ApiResponse(200, updatedTransaction));
        } else if (transactionPaymentStatus == "REJECT") {
            /// UPDATE TRANSACTION STATUS
            const updatedTransaction = await Transaction.findByIdAndUpdate(
                id,
                {
                    transactionStatus: transactionPaymentStatus,
                    previousAmount: parseFloat(user.walletAmount),
                    currentAmount: parseFloat(user.walletAmount) - parseFloat(transaction.transactionAmount)
                },
                { new: true }
            );
            console.log(updatedTransaction);
            /// APPROVED/REJECT

            await User.findByIdAndUpdate(
                transaction.userId,

                {
                    walletAmount:
                        transactionPaymentStatus == "APPROVED"
                            ? parseFloat(user.walletAmount) - parseFloat(transaction.transactionAmount)
                            : parseFloat(user.walletAmount) - 0
                },
                { new: true }
            );

            return res.status(200).json(new ApiResponse(200, updatedTransaction));
        } else {
            throw new ApiError(400, "Insufficient balance");
        }
    } else if (type.toLowerCase() == "credit") {
        if (transactionPaymentStatus == "APPROVED") {
            /// UPDATE TRANSACTION STATUS
            const updatedTransaction = await Transaction.findByIdAndUpdate(
                id,
                {
                    transactionStatus: transactionPaymentStatus,
                    previousAmount: parseFloat(user.walletAmount),
                    currentAmount: parseFloat(user.walletAmount) + parseFloat(transaction.transactionAmount)
                },
                { new: true }
            );
            console.log(updatedTransaction);
            /// APPROVED/REJECT

            await User.findByIdAndUpdate(
                transaction.userId,

                {
                    walletAmount:
                        transactionPaymentStatus == "APPROVED"
                            ? parseFloat(user.walletAmount) + parseFloat(transaction.transactionAmount)
                            : parseFloat(user.walletAmount) - 0
                },
                { new: true }
            );

            return res.status(200).json(new ApiResponse(200, updatedTransaction));
        } else if (transactionPaymentStatus == "REJECT") {
            /// UPDATE TRANSACTION STATUS
            const updatedTransaction = await Transaction.findByIdAndUpdate(
                id,
                {
                    transactionStatus: transactionPaymentStatus
                    // previousAmount: parseFloat(user.walletAmount),
                    // currentAmount: parseFloat(user.walletAmount) - parseFloat(transaction.transactionAmount)
                },
                { new: true }
            );
            console.log(updatedTransaction);
            /// APPROVED/REJECT

            // await User.findByIdAndUpdate(
            //     transaction.userId,

            //     {
            //         walletAmount: transactionPaymentStatus == "APPROVED" ?
            //             parseFloat(user.walletAmount) - parseFloat(transaction.transactionAmount)
            //             : parseFloat(user.walletAmount) - 0,
            //     },
            //     { new: true }
            // );

            return res.status(200).json(new ApiResponse(200, updatedTransaction));
        } else {
            throw new ApiError(400, "Insufficient balance");
        }
    }
});

/// Add Bonus Amount
export const addBonusAmount = asyncHandler(async (req, res) => {
    const { transactionAmount, description } = req.body;

    let filter = {};

    try {
        const usersList = await User.find(filter);

        const bulkOperations = usersList.map((user) => {
            console.log(user.walletAmount);

            return {
                updateOne: {
                    filter: { _id: user._id },
                    update: {
                        $set: { walletAmount: parseFloat(user.walletAmount) + parseFloat(transactionAmount) }
                    }
                }
            };
        });

        await User.bulkWrite(bulkOperations);

        const newFundOperations = usersList.map((user) => {
            return new Transaction({
                userId: user._id,
                transactionType: TransactionTypeEnums.CREDIT,
                transactionId: `${Date.now()}`,
                transactionStatus: TransactionPaymentEnums.SUCCESS,
                previousAmount: parseFloat(user.walletAmount),
                transactionAmount,
                currentAmount: parseFloat(user.walletAmount) + parseFloat(transactionAmount),
                description,
                addedBy: "admin",
                paymentFor: "fund"
            }).save();
        });

        await Promise.all(newFundOperations);

        return res.status(201).json(new ApiResponse(200, "Bonus added successfully"));
    } catch (error) {
        console.error("Error adding Bonus:", error);
        throw new ApiError(500, "Error adding Bonus: " + error);
    }
});

/// Remove Transaction
export const removeTransaction = asyncHandler(async (req, res) => {
    const { userId, transactionId, transactionAmount } = req.body;

    try {
        const transaction = await Transaction.findOneAndDelete({
            userId,
            transactionId,
            transactionAmount: parseFloat(transactionAmount)
        });

        if (!transaction) {
            throw new ApiError(500, "Error transaction not found");
        }

        const user = await User.findById(userId);

        console.log(user);

        await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    walletAmount: parseFloat(user.walletAmount) - parseFloat(transactionAmount)
                }
            },
            { new: true }
        );

        return res.status(200).json(new ApiResponse(200, "Transaction removed successfully"));
    } catch (error) {
        console.error("Error  Transaction :", error);
        throw new ApiError(500, "Error Transaction :" + error);
    }
});

/// Get Customer Balance
export const getCustomerBalance = asyncHandler(async (req, res) => {
    const { username, startDate, endDate } = req.query;

    let filter = {};

    if (username) {
        const user = await User.findOne({ username });
        filter.userId = user._id;
    }
    // date range filter
    if (startDate && endDate) {
        filter.createdAt = { $gte: new Date(`${startDate}T00:00:00.000Z`), $lte: new Date(`${endDate}T23:59:59.999Z`) };
    }

    console.log(filter);

    try {
        const totalTransactions = await Transaction.aggregate([
            {
                $match: filter
            },
            // {
            //     $lookup: {
            //         from: 'users',
            //         localField: 'userId',
            //         foreignField: '_id',
            //         as: 'userData'
            //     }
            // },
            // {
            //     $unwind: {
            //         path: '$userData',
            //         preserveNullAndEmptyArrays: true
            //     }
            // },
            // {
            //     $project: {
            //         previousAmount: 1,
            //         transactionAmount: 1,
            //         currentAmount: 1,
            //         createdAt: 1,
            //         updatedAt: 1,
            //         name: "$userData.name",
            //         username: "$userData.username",
            //         mobile: "$userData.mobile",
            //     }
            // },
            // {
            //     $sort: {
            //         createdAt: -1,
            //     },
            // }

            { $group: { _id: "$userId", data: { $push: "$$ROOT" } } },
            { $project: { _id: 0, userId: "$_id", allData: "$data" } },
            { $unwind: "$allData" },
            {
                $group: {
                    _id: {
                        userId: "$userId",
                        transactionType: "$allData.transactionType",
                        addedBy: "$allData.addedBy",
                        paymentFor: "$allData.paymentFor"
                    },
                    data: { $push: "$allData" }
                }
            },
            {
                $project: {
                    _id: 0,
                    userId: "$_id.userId",
                    transactionType: "$_id.transactionType",
                    addedBy: "$_id.addedBy",
                    paymentFor: "$_id.paymentFor",
                    dataLength: { $size: "$data" },
                    allData: "$data"
                }
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
                                transactionAmount: "$$data.transactionAmount"
                            }
                        }
                    }
                }
            },
            { $unwind: "$allData" },
            {
                $group: {
                    _id: {
                        userId: "$allData.userId",
                        transactionType: "$allData.transactionType",
                        addedBy: "$allData.addedBy",
                        paymentFor: "$allData.paymentFor"
                    },
                    totalTransactionAmount: {
                        $sum: "$allData.transactionAmount"
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    userId: "$_id.userId",
                    transactionType: "$_id.transactionType",
                    addedBy: "$_id.addedBy",
                    paymentFor: "$_id.paymentFor",
                    totalTransactionAmount: 1
                }
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
                                                { $eq: ["$$detail.transactionType", "DEBIT"] }
                                                // { $eq: ["$$detail.addedBy", "self"] },
                                                // { $eq: ["$$detail.paymentFor", "fund"] },
                                            ]
                                        },
                                        then: "$$detail.totalTransactionAmount",
                                        else: 0
                                    }
                                }
                            }
                        }
                    },
                    transactionCreditAmount: {
                        $sum: {
                            $map: {
                                input: ["$$ROOT"],
                                as: "detail",
                                in: {
                                    $cond: {
                                        if: {
                                            $eq: ["$$detail.transactionType", "CREDIT"]
                                        },
                                        then: "$$detail.totalTransactionAmount",
                                        else: 0
                                    }
                                }
                            }
                        }
                    },
                    transactionWithdrawalAmount: {
                        $sum: {
                            $map: {
                                input: ["$$ROOT"],
                                as: "detail",
                                in: {
                                    $cond: {
                                        if: {
                                            $eq: ["$$detail.transactionType", "WITHDRAW"]
                                        },
                                        then: "$$detail.totalTransactionAmount",
                                        else: 0
                                    }
                                }
                            }
                        }
                    }
                }
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
                    paymentFor: 1
                }
            },
            {
                $group: {
                    _id: "$userId",
                    transactionDebitAmount: {
                        $sum: "$transactionDebitAmount"
                    },
                    transactionCreditAmount: {
                        $sum: "$transactionCreditAmount"
                    },
                    transactionWithdrawalAmount: {
                        $sum: "$transactionWithdrawalAmount"
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    userId: "$_id",
                    transactionDebitAmount: 1,
                    transactionCreditAmount: 1,
                    transactionWithdrawalAmount: 1
                }
            },
            {
                $lookup: {
                    from: "bidings",
                    localField: "userId",
                    foreignField: "userId",
                    as: "bidingsResult"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "result"
                }
            },
            {
                $unwind: "$bidingsResult"
            },
            {
                $match: {
                    "bidingsResult.createdAt": {
                        $gte: new Date(`${startDate}T00:00:00.000Z`),
                        $lte: new Date(`${endDate}T23:59:59.999Z`)
                    }
                }
            },
            {
                $group: {
                    _id: "$userId",
                    username: {
                        $first: { $arrayElemAt: ["$result.username", 0] }
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
                        $sum: "$bidingsResult.gameAmount"
                    },
                    transactionWinAmount: {
                        $sum: "$bidingsResult.winAmount"
                    },
                    transactionDebitAmount: {
                        $first: "$transactionDebitAmount"
                    },
                    transactionCreditAmount: {
                        $first: "$transactionCreditAmount"
                    },
                    transactionWithdrawalAmount: {
                        $first: "$transactionWithdrawalAmount"
                    }
                }
            }
        ]);

        const userList = await User.find({}, { _id: 1, walletAmount: 1 });

        // for (let user of userList) {
        //     let foundMatch = false;

        //     for (let transaction of totalTransactions) {
        //         if (transaction["_id"].equals(user["_id"])) {
        //             console.log("Babu1 ( If Match ) ");
        //             console.log(transaction["currentWalletAmount"]);

        //             await UserHistoryData.create({
        //                 userId: user["_id"],
        //                 walletAmount: transaction["currentWalletAmount"],
        //                 bidAmount: transaction["transactionBidAmount"],
        //                 winAmount: transaction["transactionWinAmount"],
        //                 transactionDebitAmount: transaction["transactionDebitAmount"],
        //                 dipositAmount: transaction["transactionCreditAmount"],
        //                 withdrawalAmount: transaction["transactionWithdrawalAmount"]
        //             });

        //             foundMatch = true;
        //             break; // No need to check further transactions for this user
        //         }
        //     }

        //     if (!foundMatch) {
        //         console.log("Babu1 ( If Not Match ) ");
        //         await UserHistoryData.create({
        //             userId: user["_id"],
        //             walletAmount: user["walletAmount"],
        //             bidAmount: 0,
        //             winAmount: 0,
        //             transactionDebitAmount: 0,
        //             dipositAmount: 0,
        //             withdrawalAmount: 0
        //         });
        //     }
        // }

        // userList.forEach(element => {
        //     console.log(element);
        // });

        return res.status(200).json(new ApiResponse(200, totalTransactions));
    } catch (error) {
        console.log(error);

        throw new ApiError(500, error);
    }
});

///add Upi
export const addUpi = asyncHandler(async (req, res) => {
    const { upi, payeeName, status, description } = req.body;

    const scanner = req.file?.filename ?? "";

    const upiData = new UpiData({ scanner, upi, payeeName, status, description });

    await upiData.save();

    return res.status(200).json(new ApiResponse(200, upiData, "Scanner uploaded sucessfully"));
});

///get totalUpi
export const getTotalUpi = asyncHandler(async (req, res) => {
    const { isApp } = req.query;

    try {
        let filter = {};

        if (isApp) {
            filter.status = true;
            filter.isPrimary = true;
        }

        const totalUpi = await UpiData.find(filter).sort({ updatedAt: -1 });

        return res.status(200).json(new ApiResponse(200, totalUpi, "Scanner retrieved sucessfully"));
    } catch (error) {
        console.error("Error Getting Upi", error);
        throw new ApiError(500, "Error Getting Upi:" + error);
    }
});

///updateUpi Upi
export const updateUpi = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { upi, payeeName, status, description } = req.body;

    const scanner = req.file?.filename ?? "";

    try {
        const detail = await UpiData.findById(id);

        const upiDetails = await UpiData.findByIdAndUpdate(
            id,
            {
                $set: {
                    scanner: scanner || detail.scanner,
                    upi: upi || detail.upi,
                    payeeName: payeeName || detail.payeeName,
                    description: description || detail.description,
                    status: status || detail.status,
                    isPrimary: status || detail.status
                }
            },
            { new: true }
        );

        return res.status(200).json(new ApiResponse(200, upiDetails, "Scanner updated sucessfully"));
    } catch (error) {
        console.error("Error Getting Upi", error);
        throw new ApiError(500, "Error Getting Upi:" + error);
    }
});

/// Delete Upi ID
export const deleteUpiById = asyncHandler(async (req, res) => {
    const upiId = req.params.id;

    try {
        const detail = await UpiData.findByIdAndDelete(upiId);

        return res.status(200).json(new ApiResponse(200, detail, "Scanner deleted sucessfully"));
    } catch (error) {
        console.error("Error Getting Upi", error);
        throw new ApiError(500, "Error Getting Upi:" + error);
    }
});
