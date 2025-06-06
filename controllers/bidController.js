import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Biding } from "../models/bidModel.js";
import { User } from "../models/userModel.js";
import mongoose, { Schema } from "mongoose";
import { Transaction } from "../models/transModel.js";
import { TransactionPaymentEnums, TransactionTypeEnums } from "../constants/constants.js";
import { areAllElementsSameInString, hasDuplicateDigitsInString } from "../utils/gameLogicUtils.js";
import { Game, GameResultModel } from "../models/gameModel.js";

// Create a new Bid
export const createBid = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { gameId, gameName, gameCategory, gameSession, gameType, gameNumber, gameAmount } = req.body;

    let gameRateType = "";

    const user = await User.findById(userId, { isBetLock: 1, isBlocked: 1, walletAmount: 1, uplines: 1 });

    if (!user) {
        throw new ApiError(500, "User not found");
    }

    if (user.isBlocked) {
        throw new ApiError(401, "You are blocked");
    }
    if (user.isBetLock) {
        throw new ApiError(401, "Your bet is locked");
    }

    if (["OPEN", "CLOSE", "ODD EVEN", "SINGLE DIGIT"].includes(gameType)) {
        gameRateType = "DIGIT";
    } else if (["JODI", "JODI CYCLE", "RED HALF", "RED FULL", "FAMILY"].includes(gameType)) {
        gameRateType = "JODI";
    } else if (
        [
            "OPEN PANA",
            "CLOSE PANA",
            "PANA",
            "SP MOTOR",
            "DP MOTOR",
            "TP MOTOR",
            "SP DP TP",
            "PANEL GROUP",
            "TWO DIGIT PANA (CP,SR)",
            "CHOICE PANA"
        ].includes(gameType)
    ) {
        if (areAllElementsSameInString(gameNumber)) {
            gameRateType = "TRIPLE PANA";
        } else if (hasDuplicateDigitsInString(gameNumber)) {
            gameRateType = "DOUBLE PANA";
        } else {
            gameRateType = "SINGLE PANA";
        }
    } else if (["DP MOTOR"].includes(gameType)) {
        gameRateType = "DOUBLE PANA";
    } else if (["TP MOTOR"].includes(gameType)) {
        gameRateType = "TRIPLE PANA";
    } else if (["OPEN HALF SANGAM", "CLOSE HALF SANGAM"].includes(gameType)) {
        gameRateType = "HALF SANGAM";
    } else if (["FULL SANGAM"].includes(gameType)) {
        gameRateType = "FULL SANGAM";
    }
    console.log(gameNumber);
    console.log(gameType);
    console.log(gameRateType);

    // Create a new Biding instance
    const newBiding = new Biding({
        uplines: user.uplines,
        userId,
        gameId,
        gameName,
        gameCategory,
        gameType,
        gameSession,
        gameRateType,
        gameNumber,
        gameAmount,
        gameRateType: gameRateType
    });

    // Save the Biding to the database
    const savedBiding = await newBiding.save();

    if (savedBiding) {
        await User.findByIdAndUpdate(
            user._id,
            {
                walletAmount: parseFloat(user.walletAmount) - parseFloat(gameAmount)
            },
            { select: "name mobile" }
        );
    }

    const newFund = new Transaction({
        userId,
        transactionType: TransactionTypeEnums.DEBIT,
        transactionStatus: TransactionPaymentEnums.SUCCESS,
        previousAmount: user.walletAmount,
        transactionAmount: gameAmount,
        currentAmount: parseFloat(user.walletAmount) - parseFloat(gameAmount),
        addedBy: "self",
        paymentFor: "bid",
        description: `${gameName} (${gameType}) ${gameNumber}`,
        gameType,
        gameSession
    });

    newFund.transactionId = newFund._id;

    const savedFund = await newFund.save();

    console.log("Fund added successfully:", savedFund);
    console.log("Biding added successfully:", savedBiding);

    return res.status(201).json(new ApiResponse(200, savedBiding));
});

// Retrieve all Bids
export const getAllBids = asyncHandler(async (req, res) => {
    const {
        userId,
        gameCategory,
        gameName,
        gameType,
        gameSession,
        resultStatus,
        username,
        startDate,
        endDate,
        limit = 1000,
        page = 1
    } = req.query;

    const skip = (page - 1) * limit;

    let filter = {};

    if (username) {
        let user = await User.findOne({ username }, { _id: 1 });
        filter.userId = new mongoose.Types.ObjectId(user._id);
    }
    if (userId) {
        filter.userId = new mongoose.Types.ObjectId(userId);
    }
    if (gameCategory) {
        filter.gameCategory = gameCategory;
    }
    if (gameName) {
        filter.gameName = gameName;
    }
    if (gameType) {
        filter.gameRateType = gameType;
    }
    if (gameSession) {
        filter.gameSession = gameSession;
    }
    if (resultStatus) {
        // filter.gameStatus = gameStatus;
        filter.resultStatus =
            resultStatus.toString().toLowerCase() == "completed" ? { $in: ["WIN", "LOSS"] } : "PENDING";
    }
    // date range filter
    if (startDate && endDate) {
        filter.createdAt = { $gte: new Date(`${startDate}T00:00:00.000Z`), $lte: new Date(`${endDate}T23:59:59.999Z`) };
    }

    console.log(filter);

    // const allBids = await Biding.find(filter);
    const allBids = await Biding.aggregate([
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
                as: "userData",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            username: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                _id: 1,
                userId: 1,
                gameId: 1,
                gameName: 1,
                gameType: 1,
                gameRateType: 1,
                gameSession: 1,
                gameCategory: 1,
                gameNumber: 1,
                gameAmount: 1,
                winAmount: 1,
                resultStatus: 1,
                createdAt: 1,
                updatedAt: 1,
                username: "$userData.username"
            }
        }
    ]);
    return res.status(200).json(new ApiResponse(200, allBids));
});

// Get Bid by User ID
export const getBidByUserId = asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const { gameCategory, resultStatus, gameName, startDate, endDate, limit = 1000, page = 1 } = req.query;

    const skip = (page - 1) * limit;

    let filter = {
        userId: new mongoose.Types.ObjectId(userId)
    };
    if (gameCategory) {
        filter.gameCategory = gameCategory;
    }

    if (resultStatus) {
        filter.resultStatus = resultStatus;
    }
    if (gameName) {
        filter.gameName = gameName;
    }

    // date range filter
    if (startDate && endDate) {
        filter.createdAt = { $gte: new Date(`${startDate}T00:00:00.000Z`), $lte: new Date(`${endDate}T23:59:59.999Z`) };
    }

    console.log(filter);

    const totalBids = await Biding.aggregate([
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
                as: "userData",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            username: 1,
                            walletAmount: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true
            }
        }
    ]);

    let totalGameAmount = 0;
    let totalWinAmount = 0;

    totalBids.forEach((element) => {
        totalGameAmount += element["gameAmount"];
    });
    totalBids.forEach((element) => {
        totalWinAmount += element["winAmount"];
    });

    return res.status(200).json(
        new ApiResponse(200, {
            totalBids: totalBids,
            totalGameAmount: totalGameAmount,
            totalWinAmount: totalWinAmount
        })
    );
});

// Retrieve a specific Bid by ID
export const getBidById = asyncHandler(async (req, res) => {
    const bidId = req.params.id;

    try {
        const bid = await Biding.findById(bidId);
        if (!bid) {
            return res.status(404).json(new ApiResponse(404, "Bid not found"));
        }
        return res.status(200).json(new ApiResponse(200, bid));
    } catch (error) {
        console.error("Error retrieving Bid:", error);
        throw new ApiError(500, "Error retrieving Bid:" + error);
    }
});

// Update a specific Bid by ID
export const updateBidById = asyncHandler(async (req, res) => {
    const bidId = req.params.id;
    const { gameName, gameCategory, gameType, gameNumber, gameAmount, resultStatus } = req.body;

    try {
        const updatedBid = await Biding.findByIdAndUpdate(
            bidId,
            {
                gameName,
                gameCategory,
                gameType,
                gameNumber,
                gameAmount,
                winAmount,
                resultStatus
            },
            { new: true }
        );

        if (!updatedBid) {
            return res.status(404).json(new ApiResponse(404, "Bid not found"));
        }

        console.log("Bid updated successfully:", updatedBid);
        return res.status(200).json(new ApiResponse(200, updatedBid));
    } catch (error) {
        console.error("Error updating Bid:", error);
        throw new ApiError(500, "Error updating Bid:" + error);
    }
});

// Delete a specific Bid by ID
export const deleteBidById = asyncHandler(async (req, res) => {
    const bidId = req.params.id;

    try {
        const deletedBid = await Biding.findByIdAndDelete(bidId);

        if (!deletedBid) {
            return res.status(404).json(new ApiResponse(404, "Bid not found"));
        }

        console.log("Bid deleted successfully:", deletedBid);
        return res.status(200).json(new ApiResponse(200, deletedBid));
    } catch (error) {
        console.error("Error deleting Bid:", error);
        throw new ApiError(500, "Error deleting Bid:" + error);
    }
});

/// Get Winners By Game Id
export const getWinnerByGameId = asyncHandler(async (req, res) => {
    const gameId = req.params.gameId;

    const { gameType, gameSession, resultStatus, startDate } = req.query;

    console.log(req.query);

    let filter = {
        gameId: new mongoose.Types.ObjectId(gameId),
        resultStatus: resultStatus
    };

    if (startDate) {
        filter.resultDeclareDate = {
            $gte: new Date(`${startDate}T00:00:00.000Z`),
            $lte: new Date(`${startDate}T23:59:59.999Z`)
        };
    }

    if (gameType) {
        filter = {
            gameId: new mongoose.Types.ObjectId(gameId),
            resultStatus: resultStatus
        };
    }

    if (gameSession) {
        if (gameSession == "OPEN") {
            filter.gameType = {
                $in: ["OPEN", "OPEN PANA"]
            };
        }
        if (gameSession == "CLOSE") {
            filter.gameType = {
                $in: [
                    "JODI",
                    "JODI CYCLE",
                    "CLOSE",
                    "CLOSE PANA",
                    "SP MOTOR",
                    "DP MOTOR",
                    "TP MOTOR",
                    "SP DP TP",
                    "ODD EVEN",
                    "PANEL GROUP",
                    "TWO DIGIT PANA(CP,SR)",
                    "CHOICE PANA"
                ]
            };
        }
    }

    try {
        const winners = await Biding.aggregate([
            {
                $match: filter
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
                $project: {
                    __v: 0,
                    "userData.__v": 0
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }
        ]);

        return res.status(200).json(new ApiResponse(200, winners));
    } catch (error) {
        console.error("Error while getting winners :", error);
        throw new ApiError(500, "Error while getting winners : " + error);
    }
});

/// Get Sales Report
export const getSalesReport = asyncHandler(async (req, res) => {
    const { startDate, endDate, gameCategory, username, dataSource } = req.query;

    let filter = {};

    // date range filter
    if (startDate && endDate) {
        filter.createdAt = { $gte: new Date(startDate + "T00:00:00.000Z"), $lte: new Date(endDate + "T23:59:59.999Z") };
    }

    if (username) {
        const user = await User.findOne({ username });
        filter.userId = new mongoose.Types.ObjectId(user._id);
    }

    try {
        let finalResult = {};

        let result = await Biding.aggregate([
            {
                $match: filter
            },
            {
                $project: {
                    totalAmount: 1,
                    gameAmount: 1,
                    winAmount: 1,
                    gameCategory: 1
                }
            },
            {
                $group: {
                    _id: "$gameCategory",
                    winningPoints: {
                        $sum: "$winAmount"
                    },
                    bidingPoints: {
                        $sum: "$gameAmount"
                    },
                    gameCategory: {
                        $first: "$gameCategory"
                    },
                    gameBazaar: {
                        $first: "$gameCategory"
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    winningPoints: 1,
                    bidingPoints: 1,
                    gameCategory: 1,
                    gameBazaar: 1,
                    profitLoss: {
                        $concat: [
                            {
                                $cond: {
                                    if: {
                                        $gt: ["$bidingPoints", "$winningPoints"]
                                    },
                                    then: "+",
                                    else: ""
                                }
                            },
                            {
                                $toString: {
                                    $subtract: ["$bidingPoints", "$winningPoints"]
                                }
                            }
                        ]
                    }
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }
        ]);

        const staticData = [
            { gameCategory: "QUICK DHAN LAXMI", gameBazaar: "QUICK DHAN LAXMI" },
            { gameCategory: "QUICK MAHA LAXMI", gameBazaar: "QUICK MAHA LAXMI" },
            { gameCategory: "DAY GAME", gameBazaar: "DAY GAME" }
        ];

        //console.log(staticData);
        console.log(result);
        finalResult = staticData.map((staticItem) => {
            const matchingResult = result.find((resultItem) => resultItem.gameCategory === staticItem.gameCategory);

            if (matchingResult) {
                const { winningPoints = 0, bidingPoints = 0, profitLoss = 0 } = matchingResult;

                return {
                    winningPoints,
                    bidingPoints,
                    gameCategory: matchingResult.gameCategory,
                    gameBazaar: matchingResult.gameBazaar,
                    profitLoss
                };
            } else {
                // If no match found, use values from static data
                return {
                    winningPoints: 0,
                    bidingPoints: 0,
                    gameCategory: staticItem.gameCategory,
                    gameBazaar: staticItem.gameBazaar,
                    profitLoss: 0
                };
            }
        });

        console.log(finalResult);

        if (gameCategory) {
            filter.gameCategory = gameCategory;

            finalResult = await Biding.aggregate([
                { $match: filter },
                {
                    $project: {
                        bidId: "$_id",
                        totalAmount: 1,
                        gameAmount: 1,
                        winAmount: 1,
                        gameName: 1,
                        gameCategory: 1
                    }
                },
                {
                    $group: {
                        _id: "$gameName",
                        bidId: {
                            $first: "$bidId"
                        },
                        winningPoints: {
                            $sum: "$winAmount"
                        },
                        bidingPoints: {
                            $sum: "$gameAmount"
                        },
                        gameCategory: {
                            $first: "$gameCategory"
                        },
                        gameBazaar: {
                            $first: "$gameName"
                        }
                    }
                },
                {
                    $project: {
                        _id: "$bidId",
                        winningPoints: 1,
                        bidingPoints: 1,
                        gameCategory: 1,
                        gameBazaar: 1,
                        profitLoss: {
                            $concat: [
                                {
                                    $cond: { if: { $gt: ["$bidingPoints", "$winningPoints"] }, then: "+", else: "" }
                                },
                                {
                                    $toString: { $subtract: ["$bidingPoints", "$winningPoints"] }
                                }
                            ]
                        }
                    }
                },
                { $sort: { createdAt: -1 } }
            ]);
        }

        return res.status(200).json(new ApiResponse(200, finalResult));
    } catch (error) {
        console.error("Error while getting winners :", error);
        throw new ApiError(500, "Error while getting winners : " + error);
    }
});

/// GET DAY GAME Report (PROFIT/LOSS)
/// ALSO  Get Quick Maha Laxmi Report (PROFIT/LOSS)
export const getRegularBazarReport = asyncHandler(async (req, res) => {
    const { startDate, gameName, gameSession, username } = req.query;

    let filter = {};
    let game = {};
    let resultDetail = {};

    const resultDay = new Date(startDate).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    try {
        if (startDate) {
            filter.createdAt = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${startDate}T23:59:59.999Z`)
            };
        }

        if (gameName) {
            game = await Game.findOne({ gameName });

            console.log(game);
            console.log({
                gameId: game._id,
                resultDeclareDate: {
                    $gte: new Date(`${startDate}T00:00:00.000Z`),
                    $lte: new Date(`${startDate}T23:59:59.999Z`)
                }
            });
            resultDetail = await GameResultModel.findOne({
                gameId: game._id,
                resultDeclareDate: {
                    $gte: new Date(`${startDate}T00:00:00.000Z`),
                    $lte: new Date(`${startDate}T23:59:59.999Z`)
                }
            });

            console.log(`resultDetail  ${resultDetail}`);

            console.log(
                `resultDetail  ${gameSession == "CLOSE-ALL" && resultDetail && resultDetail.closeResultNumber != null}`
            );

            if (!game) {
                console.error("Game not found");
                throw new ApiError(500, "Game not found ");
            } else {
                filter.gameId = new mongoose.Types.ObjectId(game._id);
            }
        }
        // console.log(gameSession);
        if (gameSession) {
            /// OPEN (1X), OPEN PANA ( 123X ) (End With X)
            if (gameSession === "OPEN") {
                filter.gameType = {
                    $in: [
                        "OPEN",
                        "OPEN PANA",
                        "SINGLE DIGIT",
                        "ODD EVEN",
                        "SP DP TP",
                        "PANEL GROUP",
                        "TWO DIGIT PANA (CP,SR)",
                        "CHOICE PANA",
                        "SP MOTOR",
                        "DP MOTOR"
                    ]
                };
                filter.gameSession = { $in: ["OPEN"] };
            } else if (gameSession === "OPEN-ALL") {
                //Open Pana, SP motor, DP motor, TP motor, SP, DP, Tp, panel group, two digit pana, choice pana.
                // CHS and Full sangam
                filter.gameType = {
                    $in: [
                        "OPEN",
                        "OPEN PANA",
                        "SINGLE DIGIT",
                        "PANA",
                        "JODI",
                        "JODI CYCLE",
                        "OPEN HALF SANGAM",
                        "CLOSE HALF SANGAM",
                        "FULL SANGAM",
                        "RED HALF",
                        "RED FULL",
                        "FAMILY",
                        "ODD EVEN",
                        "SP MOTOR",
                        "DP MOTOR",
                        "SP DP TP",
                        "PANEL GROUP",
                        "TWO DIGIT PANA (CP,SR)",
                        "CHOICE PANA"
                    ]
                };
                filter.gameSession = { $in: ["OPEN"] };
            } else if (gameSession === "CLOSE") {
                filter.gameType = {
                    $in: [
                        "CLOSE",
                        "SINGLE DIGIT",
                        "CLOSE PANA",
                        "ODD EVEN",
                        "SP DP TP",
                        "PANEL GROUP",
                        "TWO DIGIT PANA (CP,SR)",
                        "CHOICE PANA",
                        "SP MOTOR",
                        "DP MOTOR"
                    ]
                };
                if (game.resultDeclareDate == null) {
                    filter.gameSession = { $in: ["CLOSE"] };
                } else {
                    filter.gameSession = { $in: ["CLOSE", "OPEN"] };
                }
            } else if (gameSession === "CLOSE-ALL") {
                filter.gameType = {
                    $in: [
                        "CLOSE",
                        "CLOSE PANA",
                        "PANA",
                        "JODI",
                        "JODI CYCLE",
                        "OPEN HALF SANGAM",
                        "CLOSE HALF SANGAM",
                        "FULL SANGAM",
                        "RED HALF",
                        "RED FULL",
                        "FAMILY",
                        "ODD EVEN",
                        "SP MOTOR",
                        "DP MOTOR",
                        "SP DP TP",
                        "PANEL GROUP",
                        "TWO DIGIT PANA (CP,SR)",
                        "CHOICE PANA"
                    ]
                };

                // resultDay === today
                if (resultDay === today && (game.resultDeclareDate == null || game.openNumber == null)) {
                    filter.gameSession = { $in: ["CLOSE"] };
                } else if (resultDay != today) {
                    filter.gameSession = { $in: ["CLOSE", "OPEN"] };
                    // filter.resultStatus = { $in: ["WIN"] };
                } else {
                    filter.gameSession = { $in: ["CLOSE", "OPEN"] };
                }
            } else if (gameSession == "HALF-SANGAM") {
                filter.gameType = { $in: ["OPEN HALF SANGAM", "CLOSE HALF SANGAM"] };
                filter.gameSession = { $in: ["CLOSE", "OPEN"] };
            } else if (gameSession == "FULL-SANGAM") {
                filter.gameType = { $in: ["FULL SANGAM"] };
            } else if (gameSession == "JODI") {
                ///Jodi, Jodi cycle, red-half, red-full, family
                filter.gameType = { $in: ["JODI", "JODI CYCLE", "RED HALF", "RED FULL", "FAMILY"] };
            }
        }

        if (username) {
            let user = await User.findOne({ username });

            if (!user) {
                console.error("User not found");
                throw new ApiError(500, "User not found ");
            } else {
                filter.userId = new mongoose.Types.ObjectId(user._id);
            }
        }

        let ds =
            gameSession == "OPEN-ALL" ||
            (gameSession == "CLOSE-ALL" &&
                (game.resultNumber != null || (resultDetail && resultDetail.gameResultNumber != null)));

        console.log(`NNNNNNNNNN : ${ds}`);
        let completeDetails = await Biding.aggregate([
            {
                $match: filter
            },
            {
                $addFields: {
                    gameNumberBeforeX: {
                        $let: {
                            vars: {
                                gameNumberBeforeX: {
                                    $regexFind: {
                                        input: "$gameNumber",
                                        regex: /^([0-9]+)/
                                    }
                                }
                            },
                            in: "$$gameNumberBeforeX.match"
                        }
                    },
                    gameNumberAfterX: {
                        $let: {
                            vars: {
                                gameNumberAfterX: {
                                    $regexFind: {
                                        input: "$gameNumber",
                                        regex: /X(.*)$/
                                    }
                                }
                            },
                            in: { $substr: ["$$gameNumberAfterX.match", 1, -1] }
                        }
                    }
                }
            },
            {
                $addFields: {
                    isTriplePanaAfterX: { $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1\1/ } },
                    isDoublePanaAfterX: { $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1/ } },
                    isTriplePanaBeforeX: { $regexMatch: { input: "$gameNumberBeforeX", regex: /(\d)\1\1/ } },
                    isDoublePanaBeforeX: { $regexMatch: { input: "$gameNumberBeforeX", regex: /(\d)\1/ } }
                }
            },
            {
                $lookup: {
                    from: "gamerates",
                    let: {
                        gameId: "$gameId",
                        gameRateType: "$gameRateType",
                        gameNumber: "$gameNumber"
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        {
                                            $eq: ["$gameId", "$$gameId"]
                                        },
                                        {
                                            $switch: {
                                                branches: [
                                                    {
                                                        case: {
                                                            $and: [
                                                                { $in: [gameSession, ["OPEN-ALL", "CLOSE-ALL"]] },
                                                                {
                                                                    $in: [
                                                                        "$$gameRateType",
                                                                        ["JODI", "JODI CYCLE", "HALF SANGAM"]
                                                                    ]
                                                                },
                                                                { $eq: [{ $strLenCP: "$$gameNumber" }, 2] }
                                                            ]
                                                        },
                                                        then: {
                                                            $eq: ["$gameType", "DIGIT"]
                                                        }
                                                    },
                                                    {
                                                        case: {
                                                            $and: [
                                                                { $in: [gameSession, ["OPEN-ALL", "CLOSE-ALL"]] },
                                                                {
                                                                    $in: [
                                                                        "$$gameRateType",
                                                                        ["JODI", "JODI CYCLE", "HALF SANGAM"]
                                                                    ]
                                                                },
                                                                { $eq: [{ $substrCP: ["$$gameNumber", 1, 1] }, "X"] },
                                                                {
                                                                    $eq: [
                                                                        {
                                                                            $strLenCP: {
                                                                                $substrCP: ["$$gameNumber", 0, 1]
                                                                            }
                                                                        },
                                                                        1
                                                                    ]
                                                                }
                                                            ]
                                                        },
                                                        then: {
                                                            $eq: ["$gameType", "DIGIT"]
                                                        }
                                                    },
                                                    {
                                                        case: {
                                                            $and: [
                                                                { $in: [gameSession, ["OPEN-ALL", "CLOSE-ALL"]] },
                                                                { $in: ["$$gameRateType", ["HALF SANGAM"]] }
                                                            ]
                                                        },
                                                        then: {
                                                            //$eq: ["$gameType", "SINGLE PANA"]
                                                            $switch: {
                                                                branches: [
                                                                    // Cheking [ HALF SANGAM ] 1X122
                                                                    {
                                                                        case: {
                                                                            $and: [
                                                                                { $eq: [gameSession, "OPEN-ALL"] },
                                                                                {
                                                                                    $eq: [
                                                                                        { $strLenCP: "$$gameNumber" },
                                                                                        5
                                                                                    ]
                                                                                },
                                                                                {
                                                                                    $eq: [
                                                                                        {
                                                                                            $substrCP: [
                                                                                                "$$gameNumber",
                                                                                                1,
                                                                                                1
                                                                                            ]
                                                                                        },
                                                                                        "X"
                                                                                    ]
                                                                                }
                                                                            ]
                                                                        },
                                                                        then: {
                                                                            $cond: {
                                                                                if: {
                                                                                    $regexMatch: {
                                                                                        input: "$gameNumberAfterX",
                                                                                        regex: /(\d)\1\1/
                                                                                    }
                                                                                }, // Three digits are the same
                                                                                then: {
                                                                                    $eq: ["$gameType", "TRIPLE PANA"]
                                                                                },
                                                                                else: {
                                                                                    $cond: {
                                                                                        if: {
                                                                                            $regexMatch: {
                                                                                                input: "$gameNumberAfterX",
                                                                                                regex: /(\d)\1/
                                                                                            }
                                                                                        }, // Two  digits are the same
                                                                                        then: {
                                                                                            $eq: [
                                                                                                "$gameType",
                                                                                                "DOUBLE PANA"
                                                                                            ]
                                                                                        },
                                                                                        else: {
                                                                                            $eq: [
                                                                                                "$gameType",
                                                                                                "SINGLE PANA"
                                                                                            ]
                                                                                        } // Default amount if condition doesn't match
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    },
                                                                    /// Cheking  [ HALF SANGAM ] 222X1
                                                                    {
                                                                        case: {
                                                                            $and: [
                                                                                { $eq: [gameSession, "OPEN-ALL"] },
                                                                                {
                                                                                    $eq: [
                                                                                        { $strLenCP: "$$gameNumber" },
                                                                                        5
                                                                                    ]
                                                                                },
                                                                                {
                                                                                    $eq: [
                                                                                        {
                                                                                            $substrCP: [
                                                                                                "$gameNumber",
                                                                                                3,
                                                                                                1
                                                                                            ]
                                                                                        },
                                                                                        "X"
                                                                                    ]
                                                                                },
                                                                                {
                                                                                    $eq: [
                                                                                        {
                                                                                            $strLenCP: {
                                                                                                $substrCP: [
                                                                                                    "$$gameNumber",
                                                                                                    1,
                                                                                                    4
                                                                                                ]
                                                                                            }
                                                                                        },
                                                                                        3
                                                                                    ]
                                                                                }
                                                                            ]
                                                                        },
                                                                        then: {
                                                                            $cond: {
                                                                                if: {
                                                                                    $regexMatch: {
                                                                                        input: "$gameNumberBeforeX",
                                                                                        regex: /(\d)\1\1/
                                                                                    }
                                                                                }, // Three digits are the same
                                                                                then: {
                                                                                    $eq: ["$gameType", "TRIPLE PANA"]
                                                                                },
                                                                                else: {
                                                                                    $cond: {
                                                                                        if: {
                                                                                            $regexMatch: {
                                                                                                input: "$gameNumberBeforeX",
                                                                                                regex: /(\d)\1/
                                                                                            }
                                                                                        }, // Two digits are the same
                                                                                        then: {
                                                                                            $eq: [
                                                                                                "$gameType",
                                                                                                "DOUBLE PANA"
                                                                                            ]
                                                                                        },
                                                                                        else: {
                                                                                            $eq: [
                                                                                                "$gameType",
                                                                                                "SINGLE PANA"
                                                                                            ]
                                                                                        } // Default amount if condition doesn't match
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    },
                                                                    {
                                                                        case: {
                                                                            $and: [
                                                                                { $eq: [gameSession, "CLOSE-ALL"] },
                                                                                {
                                                                                    $eq: [
                                                                                        { $strLenCP: "$$gameNumber" },
                                                                                        5
                                                                                    ]
                                                                                },
                                                                                {
                                                                                    $eq: [
                                                                                        {
                                                                                            $substrCP: [
                                                                                                "$gameNumber",
                                                                                                3,
                                                                                                1
                                                                                            ]
                                                                                        },
                                                                                        "X"
                                                                                    ]
                                                                                },
                                                                                {
                                                                                    $eq: [
                                                                                        {
                                                                                            $strLenCP: {
                                                                                                $substrCP: [
                                                                                                    "$$gameNumber",
                                                                                                    1,
                                                                                                    4
                                                                                                ]
                                                                                            }
                                                                                        },
                                                                                        3
                                                                                    ]
                                                                                }
                                                                            ]
                                                                        },
                                                                        then: { $eq: ["$gameType", "SINGLE PANA"] }
                                                                    }
                                                                ],
                                                                default: { $eq: ["$gameType", "SINGLE PANA"] }
                                                            }
                                                        }
                                                    }
                                                ],
                                                default: {
                                                    $eq: ["$gameType", "$$gameRateType"]
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "gamerates"
                }
            },
            {
                $addFields: {
                    gameRateAmount: { $arrayElemAt: ["$gamerates.gamePrice", 0] }
                }
            },
            {
                $group: {
                    _id: {
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: [gameSession, "OPEN-ALL"] },
                                    then: {
                                        $cond: {
                                            if: { $eq: [{ $strLenCP: "$gameNumber" }, 2] },
                                            then: {
                                                $substr: [
                                                    "$gameNumber",
                                                    0,
                                                    { $subtract: [{ $strLenCP: "$gameNumber" }, 1] }
                                                ]
                                            },
                                            else: {
                                                $let: {
                                                    vars: {
                                                        regexResult: {
                                                            $regexFind: { input: "$gameNumber", regex: /(.+)X/ }
                                                        }
                                                    },
                                                    in: {
                                                        $ifNull: [
                                                            { $arrayElemAt: ["$$regexResult.captures", 0] },
                                                            "$gameNumber"
                                                        ]
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                {
                                    case: {
                                        $and: [
                                            { $eq: [gameSession, "CLOSE-ALL"] },
                                            { $eq: ["$resultStatus", "PENDING"] },
                                            {
                                                $ne: [
                                                    "$gameType",
                                                    ["JODI", "OPEN HALF SANGAM", "CLOSE HALF SANGAM", "FULL SANGAM"]
                                                ]
                                            }
                                        ]
                                    },
                                    then: {
                                        $cond: {
                                            if: { $eq: [{ $strLenCP: "$gameNumber" }, 2] },
                                            then: {
                                                $substr: [
                                                    "$gameNumber",
                                                    1,
                                                    { $subtract: [{ $strLenCP: "$gameNumber" }, 1] }
                                                ]
                                            },
                                            else: {
                                                $let: {
                                                    vars: {
                                                        regexResult: {
                                                            $regexFind: { input: "$gameNumber", regex: /X(.*)$/ }
                                                        }
                                                    },
                                                    in: {
                                                        $ifNull: [
                                                            { $arrayElemAt: ["$$regexResult.captures", 0] },
                                                            "$gameNumber"
                                                        ]
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                {
                                    case: {
                                        $and: [
                                            { $eq: [gameSession, "CLOSE-ALL"] },
                                            { $eq: ["$updatedBy", "CLOSE"] },
                                            {
                                                $ne: [
                                                    "$gameType",
                                                    ["JODI", "OPEN HALF SANGAM", "CLOSE HALF SANGAM", "FULL SANGAM"]
                                                ]
                                            }
                                        ]
                                    },
                                    then: {
                                        $cond: {
                                            if: { $eq: [{ $strLenCP: "$gameNumber" }, 2] },
                                            then: {
                                                $substr: [
                                                    "$gameNumber",
                                                    1,
                                                    { $subtract: [{ $strLenCP: "$gameNumber" }, 1] }
                                                ]
                                            },
                                            else: {
                                                $let: {
                                                    vars: {
                                                        regexResult: {
                                                            $regexFind: { input: "$gameNumber", regex: /X(.*)$/ }
                                                        }
                                                    },
                                                    in: {
                                                        $ifNull: [
                                                            { $arrayElemAt: ["$$regexResult.captures", 0] },
                                                            "$gameNumber"
                                                        ]
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            ],
                            default: "$gameNumber"
                        }
                    },
                    totalBids: {
                        $addToSet: "$$ROOT"
                    },
                    gameRateAmount: {
                        $addToSet: "$gameRateAmount"
                    },
                    totalBidsAmount: {
                        $sum: {
                            $switch: {
                                branches: [
                                    /// Cheking [ OPNE HALF SANGAM ] 1X122
                                    {
                                        case: {
                                            $and: [
                                                { $eq: [gameSession, "OPEN-ALL"] },
                                                { $eq: [{ $strLenCP: "$gameNumber" }, 5] },
                                                { $eq: [{ $substrCP: ["$gameNumber", 1, 1] }, "X"] }
                                            ]
                                        },
                                        then: {
                                            $cond: {
                                                if: { $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1\1/ } }, // Three digits are the same
                                                then: { $divide: ["$gameAmount", 4] },
                                                else: {
                                                    $cond: {
                                                        if: {
                                                            $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1/ }
                                                        }, // Two  digits are the same
                                                        then: { $divide: ["$gameAmount", 2] },
                                                        else: "$gameAmount" // Default amount if condition doesn't match
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    /// Cheking  [ CLOSE HALF SANGAM ] 222X1
                                    {
                                        case: {
                                            $and: [
                                                { $eq: [gameSession, "OPEN-ALL"] },
                                                { $eq: [{ $strLenCP: "$gameNumber" }, 5] },
                                                { $eq: [{ $substrCP: ["$gameNumber", 3, 1] }, "X"] }
                                            ]
                                        },
                                        then: {
                                            $cond: {
                                                if: { $regexMatch: { input: "$gameNumberBeforeX", regex: /(\d)\1\1/ } }, // Three digits are the same
                                                then: { $divide: ["$gameAmount", 4] },
                                                else: {
                                                    $cond: {
                                                        if: {
                                                            $regexMatch: {
                                                                input: "$gameNumberBeforeX",
                                                                regex: /(\d)\1/
                                                            }
                                                        }, // Two digits are the same
                                                        then: { $divide: ["$gameAmount", 2] },
                                                        else: "$gameAmount" // Default amount if condition doesn't match
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    // Cheking [ FULL SANGAM ]  235X100 [ TP X (SP,DP,TP) ]
                                    {
                                        case: {
                                            $and: [
                                                { $eq: [gameSession, "OPEN-ALL"] },
                                                { $eq: [{ $strLenCP: "$gameNumber" }, 7] },
                                                { $eq: [{ $substrCP: ["$gameNumber", 3, 1] }, "X"] },
                                                { $regexMatch: { input: "$gameNumberBeforeX", regex: /(\d)\1\1/ } }
                                            ]
                                        },
                                        then: { $divide: ["$gameAmount", 4] }
                                    },
                                    /// Cheking [ FULL SANGAM ]  235X100 [ DP X (SP,DP,TP) ]
                                    {
                                        case: {
                                            $and: [
                                                { $eq: [gameSession, "OPEN-ALL"] },
                                                { $eq: [{ $strLenCP: "$gameNumber" }, 7] },
                                                { $eq: [{ $substrCP: ["$gameNumber", 3, 1] }, "X"] },
                                                { $regexMatch: { input: "$gameNumberBeforeX", regex: /(\d)\1/ } }
                                            ]
                                        },
                                        then: {
                                            $switch: {
                                                branches: [
                                                    {
                                                        case: {
                                                            $regexMatch: {
                                                                input: "$gameNumberAfterX",
                                                                regex: /(\d)\1\1/
                                                            }
                                                        }, // Three digits are the same
                                                        then: { $divide: ["$gameAmount", 4] }
                                                    },
                                                    {
                                                        case: {
                                                            $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1/ }
                                                        }, // Two digits are the same
                                                        then: { $divide: ["$gameAmount", 4] }
                                                    },
                                                    {
                                                        case: {
                                                            $regexMatch: {
                                                                input: "$gameNumberAfterX",
                                                                regex: /^(?!.*(.).*\1).*$/
                                                            }
                                                        }, // all are the diffrent
                                                        then: { $divide: ["$gameAmount", 2] }
                                                    }
                                                ],
                                                default: "$gameAmount" // Default amount if condition doesn't match
                                            }
                                        }
                                    },
                                    // Cheking [ FULL SANGAM ]  235X100 [SP  X (SP,DP,TP) ]
                                    {
                                        case: {
                                            $and: [
                                                { $eq: [gameSession, "OPEN-ALL"] },
                                                { $eq: [{ $strLenCP: "$gameNumber" }, 7] },
                                                { $eq: [{ $substrCP: ["$gameNumber", 3, 1] }, "X"] },
                                                {
                                                    $regexMatch: {
                                                        input: "$gameNumberBeforeX",
                                                        regex: /^(?!.*(.).*\1).*$/
                                                    }
                                                }
                                            ]
                                        },
                                        then: {
                                            $cond: {
                                                if: { $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1\1/ } }, // Three digits are the same
                                                then: { $divide: ["$gameAmount", 4] },
                                                else: {
                                                    $cond: {
                                                        if: {
                                                            $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1/ }
                                                        }, // Two digits are the same
                                                        then: { $divide: ["$gameAmount", 2] },
                                                        else: "$gameAmount" // Default amount if condition doesn't match
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    /// <----- CLOSE ALL [ HALF-SANGAM ] -----> ///
                                    /// (I). CHECK FOR [ OPEN X (SP,DP,TP)] -> 1X123
                                    {
                                        case: {
                                            $and: [
                                                { $eq: [gameSession, "CLOSE-ALL"] },
                                                { $eq: [{ $strLenCP: "$gameNumber" }, 5] },
                                                { $eq: [{ $substrCP: ["$gameNumber", 1, 1] }, "X"] }
                                            ]
                                        },
                                        then: {
                                            $switch: {
                                                branches: [
                                                    {
                                                        case: {
                                                            $regexMatch: {
                                                                input: "$gameNumberAfterX",
                                                                regex: /(\d)\1\1/
                                                            }
                                                        }, // Three digits are the same
                                                        then: { $multiply: ["$gameAmount", 2.5] }
                                                    },
                                                    {
                                                        case: {
                                                            $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1/ }
                                                        }, // Two digits are the same
                                                        then: { $multiply: ["$gameAmount", 5] }
                                                    },
                                                    {
                                                        case: {
                                                            $regexMatch: {
                                                                input: "$gameNumberAfterX",
                                                                regex: /^(?!.*(.).*\1).*$/
                                                            }
                                                        }, // all are the diffrent
                                                        then: { $multiply: ["$gameAmount", 10] }
                                                    }
                                                ],
                                                default: "$gameAmount" // Default amount if condition doesn't match
                                            }
                                        }
                                    },
                                    /// (II). CHECK FOR [ (SP,DP,TP) X CLOSE ] -> 123X1
                                    {
                                        case: {
                                            $and: [
                                                { $eq: [gameSession, "CLOSE-ALL"] },
                                                { $eq: [{ $strLenCP: "$gameNumber" }, 5] },
                                                { $eq: [{ $substrCP: ["$gameNumber", 3, 1] }, "X"] }
                                            ]
                                        },
                                        then: {
                                            $multiply: ["$gameAmount", { $arrayElemAt: ["$gamerates.gamePrice", 0] }]
                                        }
                                    },
                                    /// <----- CLOSE ALL [ FULL-SANGAM ] -----> ///
                                    /// (I). CHECK FOR [ SP X (TP,DP,SP)]
                                    {
                                        case: {
                                            $and: [
                                                { $eq: [gameSession, "CLOSE-ALL"] },
                                                { $eq: [{ $strLenCP: "$gameNumber" }, 7] },
                                                { $eq: [{ $substrCP: ["$gameNumber", 3, 1] }, "X"] }
                                            ]
                                        },
                                        then: {
                                            $switch: {
                                                branches: [
                                                    {
                                                        case: {
                                                            $regexMatch: {
                                                                input: "$gameNumberAfterX",
                                                                regex: /(\d)\1\1/
                                                            }
                                                        }, // Three digits are the same
                                                        then: { $multiply: ["$gameAmount", 50] }
                                                    },
                                                    {
                                                        case: {
                                                            $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1/ }
                                                        }, // Two digits are the same
                                                        then: { $multiply: ["$gameAmount", 75] }
                                                    },
                                                    {
                                                        case: {
                                                            $regexMatch: {
                                                                input: "$gameNumberAfterX",
                                                                regex: /^(?!.*(.).*\1).*$/
                                                            }
                                                        }, // all are the diffrent
                                                        then: { $multiply: ["$gameAmount", 150] }
                                                    }
                                                ],
                                                default: "$gameAmount" // Default amount if condition doesn't match
                                            }
                                        }
                                    },
                                    /// Cheking [ JODI  ] 22
                                    {
                                        case: {
                                            $and: [
                                                { $eq: [gameSession, "CLOSE-ALL"] },
                                                { $eq: [{ $strLenCP: "$gameNumber" }, 2] },
                                                { $not: { $regexMatch: { input: "$gameNumber", regex: "X" } } }
                                            ]
                                        },
                                        then: {
                                            $multiply: [
                                                "$gameAmount",
                                                {
                                                    $switch: {
                                                        branches: [
                                                            {
                                                                case: {
                                                                    $and: [
                                                                        { $eq: [gameSession, "CLOSE-ALL"] },
                                                                        {
                                                                            $in: [
                                                                                "$gameType",
                                                                                [
                                                                                    "JODI",
                                                                                    "JODI CYCLE",
                                                                                    "RED HALF",
                                                                                    "RED FULL",
                                                                                    "FAMILY"
                                                                                ]
                                                                            ]
                                                                        }
                                                                    ]
                                                                },
                                                                then: 10
                                                            }
                                                        ],
                                                        default: { $arrayElemAt: ["$gamerates.gamePrice", 0] }
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                ],
                                /// By Default SP for [ HALF SANGAM ], SPXSP [ FULL SANGAM ]
                                default: "$gameAmount"
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    gameNumber: "$_id",
                    totalBidsAmount: "$totalBidsAmount",
                    gameRateAmount: {
                        $arrayElemAt: ["$gameRateAmount", 0]
                    },
                    gameId: {
                        $arrayElemAt: ["$totalBids.gameId", 0]
                    },
                    gameSession: {
                        $arrayElemAt: ["$totalBids.gameSession", 0]
                    },
                    resultStatus: {
                        $arrayElemAt: ["$totalBids.resultStatus", 0]
                    },
                    gameType: {
                        $arrayElemAt: ["$totalBids.gameType", 0]
                    },
                    gameNumberBeforeX: {
                        $arrayElemAt: ["$totalBids.gameNumberBeforeX", 0]
                    },
                    gameNumberAfterX: {
                        $arrayElemAt: ["$totalBids.gameNumberAfterX", 0]
                    },
                    totalBids: "$totalBids"
                }
            },
            {
                $project: {
                    _id: 0,
                    gameId: 1,
                    gameNumber: 1,
                    gameNumberBeforeX: 1,
                    gameNumberAfterX: 1,
                    gameRateAmount: 1,
                    totalBidsAmount: 1,
                    gameType: 1,
                    gameSession: 1,
                    gameType: 1,
                    resultStatus: 1,
                    totalAmountToPay: {
                        $multiply: [
                            {
                                $toDouble: "$totalBidsAmount"
                            },
                            {
                                $toDouble: "$gameRateAmount"
                            }
                        ]
                    }
                }
            },
            {
                $facet: {
                    totalBidsAmountSum: [
                        {
                            $group: {
                                _id: "$gameType",
                                totalBidsAmountAll: {
                                    $sum: "$totalBidsAmount"
                                }
                            }
                        }
                    ],
                    documents: [
                        {
                            $project: {
                                _id: 0
                            }
                        }
                    ]
                }
            },
            {
                $unwind: "$documents"
            },
            {
                $addFields: {
                    newGameRate: "$documents.gameRateAmount",
                    newTotalAmoutToPay: {
                        $multiply: [
                            {
                                $toDouble: "$documents.totalBidsAmount"
                            },
                            {
                                $toDouble: "$documents.gameRateAmount"
                            }
                        ]
                    },
                    newTotalBidsAmountSum: {
                        $switch: {
                            branches: [
                                {
                                    case: {
                                        $or: [{ $eq: [gameSession, "HALF-SANGAM"] }, { $eq: [gameSession, "JODI"] }]
                                    },
                                    then: { $sum: "$totalBidsAmountSum.totalBidsAmountAll" }
                                },
                                {
                                    case: {
                                        $and: [
                                            { $eq: [gameSession, "OPEN"] },
                                            { $eq: [{ $strLenCP: "$documents.gameNumber" }, 4] }
                                        ]
                                    },
                                    then: {
                                        $sum: {
                                            $map: {
                                                input: "$totalBidsAmountSum",
                                                as: "sum",
                                                in: {
                                                    $cond: [
                                                        {
                                                            $in: [
                                                                "$$sum._id",
                                                                [
                                                                    "OPEN PANA",
                                                                    "ODD EVEN",
                                                                    "SP DP TP",
                                                                    "PANEL GROUP",
                                                                    "TWO DIGIT PANA (CP,SR)",
                                                                    "CHOICE PANA",
                                                                    "SP MOTOR",
                                                                    "DP MOTOR"
                                                                ]
                                                            ]
                                                        },
                                                        "$$sum.totalBidsAmountAll",
                                                        0
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                },
                                {
                                    case: {
                                        $and: [
                                            { $eq: [gameSession, "CLOSE"] },
                                            { $eq: [{ $strLenCP: "$documents.gameNumber" }, 4] }
                                        ]
                                    },
                                    then: {
                                        $sum: {
                                            $map: {
                                                input: "$totalBidsAmountSum",
                                                as: "sum",
                                                in: {
                                                    $cond: [
                                                        {
                                                            $in: [
                                                                "$$sum._id",
                                                                [
                                                                    "OPEN PANA",
                                                                    "ODD EVEN",
                                                                    "SP DP TP",
                                                                    "PANEL GROUP",
                                                                    "TWO DIGIT PANA (CP,SR)",
                                                                    "CHOICE PANA",
                                                                    "SP MOTOR",
                                                                    "DP MOTOR"
                                                                ]
                                                            ]
                                                        },
                                                        "$$sum.totalBidsAmountAll",
                                                        0
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                }
                            ],
                            default: {
                                $arrayElemAt: [
                                    "$totalBidsAmountSum.totalBidsAmountAll",
                                    {
                                        $indexOfArray: ["$totalBidsAmountSum._id", "$documents.gameType"]
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    gameNumber: {
                        $cond: {
                            if: {
                                $and: [
                                    { $or: [{ $eq: [gameSession, "OPEN-ALL"] }, { $eq: [gameSession, "CLOSE-ALL"] }] },
                                    {
                                        $not: {
                                            $regexMatch: { input: "$documents.gameNumber", regex: "X", options: "i" }
                                        }
                                    }
                                ]
                            },
                            then: { $concat: ["$documents.gameNumber", "X"] },
                            else: { $arrayElemAt: [{ $split: ["$documents.gameNumber", "-"] }, 0] }
                        }
                    },
                    gameId: "$documents.gameId",
                    gameNumberBeforeX: "$documents.gameNumberBeforeX",
                    gameNumberAfterX: "$documents.gameNumberAfterX",
                    gameRateAmount: "$documents.gameRateAmount",
                    totalBidsAmount: "$documents.totalBidsAmount",
                    gameSession: "$documents.gameSession",
                    resultStatus: "$documents.resultStatus",
                    gameNumberBeforeX: "$documents.gameNumberBeforeX",
                    gameType: "$documents.gameType",
                    totalAmountToPay: "$newTotalAmoutToPay",
                    winAmount: {
                        $cond: {
                            if: { $lt: ["$newTotalAmoutToPay", "$newTotalBidsAmountSum"] },
                            then: { $subtract: ["$newTotalBidsAmountSum", "$newTotalAmoutToPay"] },
                            else: 0
                        }
                    },
                    lossAmount: {
                        $cond: {
                            if: { $gt: ["$newTotalAmoutToPay", "$newTotalBidsAmountSum"] },
                            then: { $subtract: ["$newTotalAmoutToPay", "$newTotalBidsAmountSum"] },
                            else: 0
                        }
                    },
                    totalBidsAmountSum: "$newTotalBidsAmountSum"
                }
            },
            ...(gameSession == "OPEN-ALL" ||
            (gameSession == "CLOSE-ALL" &&
                (game.resultNumber != null || (resultDetail && resultDetail.gameResultNumber != null)))
                ? [
                      {
                          $match:
                              gameSession == "CLOSE-ALL" && game.closeNumber == null && resultDay === today
                                  ? { resultStatus: "PENDING" }
                                  : gameSession == "CLOSE-ALL" && resultDetail && resultDetail.gameResultNumber != null
                                    ? {
                                          $expr: {
                                              $switch: {
                                                  branches: [
                                                      {
                                                          case: {
                                                              $in: [
                                                                  "$gameType",
                                                                  [
                                                                      "CLOSE",
                                                                      "CLOSE PANA",
                                                                      "SP MOTOR",
                                                                      "DP MOTOR",
                                                                      "DP MOTOR",
                                                                      "SP DP TP",
                                                                      "ODD EVEN",
                                                                      "PANEL GROUP",
                                                                      "TWO DIGIT PANA (CP,SR)",
                                                                      "CHOICE PANA"
                                                                  ]
                                                              ]
                                                          },
                                                          then: {
                                                              $eq: ["$gameSession", "CLOSE"]
                                                          }
                                                      }
                                                  ],
                                                  default: {
                                                      $eq: ["$gameSession", "OPEN"]
                                                  }
                                              }
                                          }
                                      }
                                    : {}
                      },
                      {
                          $group: {
                              _id: {
                                  $strLenCP: "$gameNumber"
                              },
                              totalBidsAmountSum: {
                                  $sum: "$totalBidsAmount"
                              },
                              documents: {
                                  $push: "$$ROOT"
                              }
                          }
                      },
                      {
                          $unwind: {
                              path: "$documents",
                              preserveNullAndEmptyArrays: true
                          }
                      },
                      {
                          $lookup: {
                              from: "gamerates",
                              let: {
                                  gameId: "$documents.gameId",
                                  gameNumber: "$documents.gameNumber",
                                  gameRateType: "$documents.gameType",
                                  gameNumberAfterX: "$documents.gameNumberAfterX",
                                  gameNumberBeforeX: "$documents.gameNumberBeforeX"
                              },
                              pipeline: [
                                  {
                                      $match: {
                                          $expr: {
                                              $and: [
                                                  {
                                                      $eq: ["$gameId", "$$gameId"]
                                                  },
                                                  {
                                                      $switch: {
                                                          branches: [
                                                              {
                                                                  case: {
                                                                      $and: [
                                                                          {
                                                                              $in: [
                                                                                  gameSession,
                                                                                  ["OPEN-ALL", "CLOSE-ALL", "OPEN"]
                                                                              ]
                                                                          },
                                                                          {
                                                                              $in: [
                                                                                  "$$gameRateType",
                                                                                  [
                                                                                      "OPEN",
                                                                                      "SINGLE DIGIT",
                                                                                      "CLOSE",
                                                                                      "JODI",
                                                                                      "JODI CYCLE",
                                                                                      "RED HALF",
                                                                                      "RED FULL",
                                                                                      "ODD EVEN",
                                                                                      "FAMILY",
                                                                                      "OPEN HALF SANGAM",
                                                                                      "CLOSE HALF SANGAM"
                                                                                  ]
                                                                              ]
                                                                          },
                                                                          {
                                                                              $or: [
                                                                                  // { $eq: [{ $strLenCP: { $substrCP: ["$$gameNumber", 0, 1] } }, 1] },
                                                                                  {
                                                                                      $eq: [
                                                                                          { $strLenCP: "$$gameNumber" },
                                                                                          2
                                                                                      ]
                                                                                  }
                                                                                  // { $eq: [{ $strLenCP: "$$gameNumberAfterX" }, 1] },
                                                                              ]
                                                                          }
                                                                      ]
                                                                  },
                                                                  then: {
                                                                      $eq: ["$gameType", "DIGIT"]
                                                                  }
                                                              },
                                                              {
                                                                  case: {
                                                                      $and: [
                                                                          {
                                                                              $in: [
                                                                                  gameSession,
                                                                                  ["OPEN-ALL", "CLOSE-ALL", "OPEN"]
                                                                              ]
                                                                          },
                                                                          {
                                                                              $in: [
                                                                                  "$$gameRateType",
                                                                                  [
                                                                                      "OPEN PANA",
                                                                                      "CLOSE PANA",
                                                                                      "PANA",
                                                                                      "OPEN HALF SANGAM",
                                                                                      "CLOSE HALF SANGAM",
                                                                                      "FULL SANGAM",
                                                                                      "SP MOTOR",
                                                                                      "DP MOTOR",
                                                                                      "SP DP TP",
                                                                                      "PANEL GROUP",
                                                                                      "JODI",
                                                                                      "JODI CYCLE",
                                                                                      "RED HALF",
                                                                                      "RED FULL",
                                                                                      "FAMILY",
                                                                                      "TWO DIGIT PANA (CP,SR)",
                                                                                      "CHOICE PANA"
                                                                                  ]
                                                                              ]
                                                                          }
                                                                      ]
                                                                  },
                                                                  then: {
                                                                      $switch: {
                                                                          branches: [
                                                                              {
                                                                                  case: {
                                                                                      $or: [
                                                                                          {
                                                                                              $eq: [
                                                                                                  gameSession,
                                                                                                  "OPEN-ALL"
                                                                                              ]
                                                                                          },
                                                                                          {
                                                                                              $eq: [
                                                                                                  gameSession,
                                                                                                  "CLOSE-ALL"
                                                                                              ]
                                                                                          }
                                                                                      ]
                                                                                  },
                                                                                  then: {
                                                                                      $cond: {
                                                                                          if: {
                                                                                              $regexMatch: {
                                                                                                  input: "$$gameNumber",
                                                                                                  regex: /(\d)\1\1/
                                                                                              }
                                                                                          }, // Three digits are the same
                                                                                          then: {
                                                                                              $eq: [
                                                                                                  "$gameType",
                                                                                                  "TRIPLE PANA"
                                                                                              ]
                                                                                          },
                                                                                          else: {
                                                                                              $cond: {
                                                                                                  if: {
                                                                                                      $regexMatch: {
                                                                                                          input: "$$gameNumber",
                                                                                                          regex: /(\d)\1/
                                                                                                      }
                                                                                                  }, // Two  digits are the same
                                                                                                  then: {
                                                                                                      $eq: [
                                                                                                          "$gameType",
                                                                                                          "DOUBLE PANA"
                                                                                                      ]
                                                                                                  },
                                                                                                  else: {
                                                                                                      $eq: [
                                                                                                          "$gameType",
                                                                                                          "SINGLE PANA"
                                                                                                      ]
                                                                                                  } // Default amount if condition doesn't match
                                                                                              }
                                                                                          }
                                                                                      }
                                                                                  }
                                                                              }
                                                                          ],
                                                                          default: { $eq: ["$gameType", "SINGLE PANA"] }
                                                                      }
                                                                  }
                                                              }
                                                          ],
                                                          default: {
                                                              $eq: ["$gameType", "$$gameRateType"]
                                                          }
                                                      }
                                                  }
                                              ]
                                          }
                                      }
                                  }
                              ],
                              as: "gamerates"
                          }
                      },
                      {
                          $addFields: {
                              gameRateType: "$documents.gameType",
                              newGameRate: { $arrayElemAt: ["$gamerates.gamePrice", 0] },
                              newTotalAmoutToPay: {
                                  $multiply: [
                                      "$documents.totalBidsAmount",
                                      { $arrayElemAt: ["$gamerates.gamePrice", 0] }
                                  ]
                              }
                          }
                      },
                      {
                          $project: {
                              _id: 0,
                              gameId: "$documents.gameId",
                              totalBidsAmountSum: 1,
                              gameNumber: "$documents.gameNumber",
                              gameNumberBeforeX: "$documents.gameNumberBeforeX",
                              gameNumberAfterX: "$documents.gameNumberAfterX",
                              gameRateAmount: "$newGameRate",
                              totalBidsAmount: "$documents.totalBidsAmount",
                              gameSession: "$documents.gameSession",
                              gameType: "$documents.gameType",
                              totalAmountToPay: "$newTotalAmoutToPay",
                              winAmount: {
                                  $switch: {
                                      branches: [
                                          {
                                              case: {
                                                  $lt: ["$newTotalAmoutToPay", "$totalBidsAmountSum"]
                                              },
                                              then: {
                                                  $subtract: ["$totalBidsAmountSum", "$newTotalAmoutToPay"]
                                              }
                                          }
                                      ],
                                      default: 0
                                  }
                              },
                              lossAmount: {
                                  $switch: {
                                      branches: [
                                          {
                                              case: {
                                                  $gt: ["$newTotalAmoutToPay", "$totalBidsAmountSum"]
                                              },
                                              then: {
                                                  $subtract: ["$totalBidsAmountSum", "$newTotalAmoutToPay"]
                                              }
                                          }
                                      ],
                                      default: 0
                                  }
                              }
                          }
                      }
                  ]
                : [])
        ]);

        // console.log(completeDetails);
        // console.log(filter);
        const modifiedFilter = { ...filter };

        delete modifiedFilter.gameType;
        delete modifiedFilter.gameSession;

        console.log(modifiedFilter);

        let summaryDetails = await Biding.aggregate([
            {
                $match: modifiedFilter
            },
            {
                $group: {
                    _id: "$gameNumber",
                    totalAmount: { $sum: "$gameAmount" },
                    winAmount: { $sum: "$winAmount" }
                }
            },
            {
                $group: {
                    _id: {
                        $cond: {
                            if: {
                                $and: [
                                    { $regexMatch: { input: "$_id", regex: /X$/ } },
                                    { $eq: [{ $strLenCP: "$_id" }, 2] }
                                ]
                            },
                            then: "OPEN",
                            else: {
                                $cond: {
                                    if: {
                                        $and: [
                                            { $regexMatch: { input: "$_id", regex: /^X/ } },
                                            { $eq: [{ $strLenCP: "$_id" }, 2] }
                                        ]
                                    },
                                    then: "CLOSE",
                                    else: {
                                        $cond: {
                                            if: {
                                                $and: [
                                                    { $regexMatch: { input: "$_id", regex: /^[^XX]{2}$/ } },
                                                    { $eq: [{ $strLenCP: "$_id" }, 2] }
                                                ]
                                            },
                                            then: "JODI",
                                            else: {
                                                $cond: {
                                                    if: {
                                                        $and: [
                                                            { $regexMatch: { input: "$_id", regex: /^X|X$/ } },
                                                            { $eq: [{ $strLenCP: "$_id" }, 4] }
                                                        ]
                                                    },
                                                    then: "PANA",
                                                    else: {
                                                        $cond: {
                                                            if: {
                                                                $and: [
                                                                    {
                                                                        $regexMatch: {
                                                                            input: "$_id",
                                                                            regex: /^.{1}X|^.X|^.+X|^.+X/
                                                                        }
                                                                    },
                                                                    { $eq: [{ $strLenCP: "$_id" }, 5] }
                                                                ]
                                                            },
                                                            then: "HALF SANGAM",
                                                            else: {
                                                                $cond: {
                                                                    if: {
                                                                        $and: [
                                                                            {
                                                                                $regexMatch: {
                                                                                    input: "$_id",
                                                                                    regex: /^.{3}X.{3}$/
                                                                                }
                                                                            },
                                                                            { $eq: [{ $strLenCP: "$_id" }, 7] }
                                                                        ]
                                                                    },
                                                                    then: "FULL SANGAM",
                                                                    else: "OtherGroup"
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    totalAmount: { $sum: "$totalAmount" },
                    totalWinAmount: { $sum: "$winAmount" },
                    values: { $push: "$_id" }
                }
            },
            {
                $group: {
                    _id: "$_id",
                    totalAmount: { $first: "$totalAmount" },
                    totalWinAmount: { $first: "$totalWinAmount" },
                    values: { $push: "$values" }
                }
            },
            {
                $project: {
                    _id: 0,
                    type: "$_id",
                    totalAmount: 1,
                    totalWinAmount: 1,
                    values: 1
                }
            }
        ]);

        return res.status(200).json(new ApiResponse(200, { completeDetails, summaryDetails }));
    } catch (error) {
        console.error(error);
        throw new ApiError(500);
    }
});

/// GET Quick Dhan Laxmi Report (PROFIT/LOSS)
export const getQuickDhanLaxmiReport = asyncHandler(async (req, res) => {
    const { startDate, gameName, username } = req.query;

    let filter = {};

    try {
        if (startDate) {
            filter.createdAt = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${startDate}T23:59:59.999Z`)
            };
            filter.createdAt = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${startDate}T23:59:59.999Z`)
            };
        }

        if (gameName) {
            let game = await Game.findOne({ gameName });

            if (!game) {
                console.error("Game not found");
                throw new ApiError(500, "Game not found ");
            } else {
                filter.gameId = new mongoose.Types.ObjectId(game._id);
                filter.gameId = new mongoose.Types.ObjectId(game._id);
            }
        }

        if (username) {
            let user = await User.findOne({ username });

            if (!user) {
            } else {
                filter.userId = new mongoose.Types.ObjectId(user._id);
                filter.userId = new mongoose.Types.ObjectId(user._id);
            }
        }

        console.log(filter);

        let comleteDetails = await Biding.aggregate([
            {
                $match: filter
            },
            {
                $lookup: {
                    from: "gamerates",
                    let: {
                        gameId: "$gameId",
                        gameRateType: "$gameRateType"
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        {
                                            $eq: ["$gameId", "$$gameId"]
                                        },
                                        {
                                            $eq: ["$gameType", "$$gameRateType"]
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "gamerates"
                }
            },
            {
                $addFields: {
                    gameRateAmount: {
                        $arrayElemAt: ["$gamerates.gamePrice", 0]
                    }
                }
            },
            {
                $group: {
                    _id: "$gameNumber",
                    totalBids: {
                        $addToSet: "$$ROOT"
                    },
                    gameRateAmount: {
                        $addToSet: {
                            $arrayElemAt: ["$gamerates.gamePrice", 0]
                        }
                    },
                    totalBidsAmount: {
                        $sum: "$gameAmount"
                    }
                }
            },
            {
                $addFields: {
                    gameNumber: "$_id",
                    totalBidsAmount: "$totalBidsAmount",
                    gameRateAmount: {
                        $arrayElemAt: ["$gameRateAmount", 0]
                    },
                    gameSession: {
                        $arrayElemAt: ["$totalBids.gameSession", 0]
                    },
                    tot: "$totalBids"
                }
            },
            {
                $project: {
                    _id: 0,
                    gameNumber: 1,
                    gameRateAmount: 1,
                    totalBidsAmount: 1,
                    gameSession: 1,
                    totalAmountToPay: {
                        $multiply: [
                            {
                                $toDouble: "$totalBidsAmount"
                            },
                            {
                                $toDouble: "$gameRateAmount"
                            }
                        ]
                    }
                }
            },
            {
                $facet: {
                    totalBidsAmountSum: [
                        {
                            $group: {
                                _id: null,
                                totalBidsAmountAll: {
                                    $sum: "$totalBidsAmount"
                                }
                            }
                        }
                    ],
                    documents: [
                        {
                            $project: {
                                _id: 0
                            }
                        }
                    ]
                }
            },
            {
                $unwind: "$documents"
            },
            {
                $project: {
                    gameNumber: "$documents.gameNumber",
                    gameRateAmount: "$documents.gameRateAmount",
                    totalBidsAmount: "$documents.totalBidsAmount",
                    gameSession: "$documents.gameSession",
                    totalAmountToPay: {
                        $multiply: [
                            {
                                $toDouble: "$documents.totalBidsAmount"
                            },
                            {
                                $toDouble: "$documents.gameRateAmount"
                            }
                        ]
                    },
                    winAmount: {
                        $cond: {
                            if: {
                                $lt: [
                                    {
                                        $toDouble: {
                                            $multiply: [
                                                {
                                                    $toDouble: "$documents.totalBidsAmount"
                                                },
                                                {
                                                    $toDouble: "$documents.gameRateAmount"
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        $toDouble: {
                                            $arrayElemAt: ["$totalBidsAmountSum.totalBidsAmountAll", 0]
                                        }
                                    }
                                ]
                            },
                            then: {
                                $subtract: [
                                    {
                                        $toDouble: {
                                            $arrayElemAt: ["$totalBidsAmountSum.totalBidsAmountAll", 0]
                                        }
                                    },
                                    {
                                        $toDouble: {
                                            $multiply: [
                                                {
                                                    $toDouble: "$documents.totalBidsAmount"
                                                },
                                                {
                                                    $toDouble: "$documents.gameRateAmount"
                                                }
                                            ]
                                        }
                                    }
                                ]
                            },
                            else: 0
                        }
                    },
                    lossAmount: {
                        $cond: {
                            if: {
                                $gt: [
                                    {
                                        $toDouble: {
                                            $multiply: [
                                                {
                                                    $toDouble: "$documents.totalBidsAmount"
                                                },
                                                {
                                                    $toDouble: "$documents.gameRateAmount"
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        $toDouble: {
                                            $arrayElemAt: ["$totalBidsAmountSum.totalBidsAmountAll", 0]
                                        }
                                    }
                                ]
                            },
                            then: {
                                $subtract: [
                                    {
                                        $toDouble: {
                                            $multiply: [
                                                {
                                                    $toDouble: "$documents.totalBidsAmount"
                                                },
                                                {
                                                    $toDouble: "$documents.gameRateAmount"
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        $toDouble: {
                                            $arrayElemAt: ["$totalBidsAmountSum.totalBidsAmountAll", 0]
                                        }
                                    }
                                ]
                            },
                            else: 0
                        }
                    },
                    totalBidsAmountSum: {
                        $arrayElemAt: ["$totalBidsAmountSum.totalBidsAmountAll", 0]
                    }
                }
            }
        ]);

        let summaryDetails = await Biding.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: "$gameNumber",
                    totalAmount: { $sum: "$gameAmount" },
                    winAmount: { $sum: "$winAmount" }
                }
            },
            {
                $group: {
                    _id: {
                        $cond: {
                            if: {
                                $and: [
                                    { $regexMatch: { input: "$_id", regex: /X$/ } },
                                    { $eq: [{ $strLenCP: "$_id" }, 2] }
                                ]
                            },
                            then: "OPEN",
                            else: {
                                $cond: {
                                    if: {
                                        $and: [
                                            { $regexMatch: { input: "$_id", regex: /^X/ } },
                                            { $eq: [{ $strLenCP: "$_id" }, 2] }
                                        ]
                                    },
                                    then: "CLOSE",
                                    else: {
                                        $cond: {
                                            if: {
                                                $and: [
                                                    { $regexMatch: { input: "$_id", regex: /^[^XX]{2}$/ } },
                                                    { $eq: [{ $strLenCP: "$_id" }, 2] }
                                                ]
                                            },
                                            then: "JODI",
                                            else: {
                                                $cond: {
                                                    if: {
                                                        $and: [
                                                            { $regexMatch: { input: "$_id", regex: /^X|X$/ } },
                                                            { $eq: [{ $strLenCP: "$_id" }, 4] }
                                                        ]
                                                    },
                                                    then: "PANA",
                                                    else: {
                                                        $cond: {
                                                            if: {
                                                                $and: [
                                                                    {
                                                                        $regexMatch: {
                                                                            input: "$_id",
                                                                            regex: /^.{1}X|^.X|^.+X|^.+X/
                                                                        }
                                                                    },
                                                                    { $eq: [{ $strLenCP: "$_id" }, 5] }
                                                                ]
                                                            },
                                                            then: "HALF SANGAM",
                                                            else: {
                                                                $cond: {
                                                                    if: {
                                                                        $and: [
                                                                            {
                                                                                $regexMatch: {
                                                                                    input: "$_id",
                                                                                    regex: /^.{3}X.{3}$/
                                                                                }
                                                                            },
                                                                            { $eq: [{ $strLenCP: "$_id" }, 7] }
                                                                        ]
                                                                    },
                                                                    then: "FULL SANGAM",
                                                                    else: "OtherGroup"
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    totalAmount: { $sum: "$totalAmount" },
                    totalWinAmount: { $sum: "$winAmount" },
                    values: { $push: "$_id" }
                }
            },
            {
                $group: {
                    _id: "$_id",
                    totalAmount: { $first: "$totalAmount" },
                    totalWinAmount: { $first: "$totalWinAmount" },
                    values: { $push: "$values" }
                }
            },
            {
                $project: {
                    _id: 0,
                    type: "$_id",
                    totalAmount: 1,
                    totalWinAmount: 1,
                    values: 1
                }
            }
        ]);

        return res.status(200).json(new ApiResponse(200, { comleteDetails, summaryDetails }));
    } catch (error) {
        console.error("", error);
        throw new ApiError(500, "" + error);
    }
});

// GET CUTTING GROUP
export const getCuttingGroupReport = asyncHandler(async (req, res) => {
    const { startDate, gameName, gameSession, username } = req.query;

    let filter = {};
    let game = {};

    if (startDate) {
        filter.createdAt = {
            $gte: new Date(`${startDate}T00:00:00.000Z`),
            $lte: new Date(`${startDate}T23:59:59.999Z`)
        };
    }

    if (gameName) {
        game = await Game.findOne({ gameName });

        if (!game) {
            console.error("Game not found");
            throw new ApiError(500, "Game not found ");
        } else {
            filter.gameId = new mongoose.Types.ObjectId(game._id);
        }
    }

    if (gameSession) {
        if (gameSession === "OPEN-ALL") {
            filter.gameType = {
                $in: [
                    "OPEN",
                    "OPEN PANA",
                    "JODI",
                    "JODI CYCLE",
                    "OPEN HALF SANGAM",
                    "CLOSE HALF SANGAM",
                    "FULL SANGAM",
                    "RED HALF",
                    "RED FULL",
                    "FAMILY",
                    "ODD EVEN",
                    "SP MOTOR",
                    "DP MOTOR",
                    "SP DP TP",
                    "PANEL GROUP",
                    "TWO DIGIT PANA (CP,SR)",
                    "CHOICE PANA"
                ]
            };
            filter.gameSession = { $in: ["CLOSE", "OPEN"] };
        } else if (gameSession === "CLOSE-ALL") {
            filter.gameType = {
                $in: [
                    "CLOSE",
                    "CLOSE PANA",
                    "JODI",
                    "JODI CYCLE",
                    "OPEN HALF SANGAM",
                    "CLOSE HALF SANGAM",
                    "FULL SANGAM",
                    "RED HALF",
                    "RED FULL",
                    "FAMILY",
                    "ODD EVEN",
                    "SP MOTOR",
                    "DP MOTOR",
                    "SP DP TP",
                    "PANEL GROUP",
                    "TWO DIGIT PANA (CP,SR)",
                    "CHOICE PANA"
                ]
            };
            if (game.resultDeclareDate == null) {
                filter.gameSession = { $in: ["CLOSE"] };
            } else {
                filter.gameSession = { $in: ["CLOSE", "OPEN"] };
            }
        }
    }

    if (username) {
        let user = await User.findOne({ username });

        if (!user) {
            console.error("User not found");
            throw new ApiError(500, "User not found ");
        } else {
            filter.userId = new mongoose.Types.ObjectId(user._id);
        }
    }

    let completeDetails = await Biding.aggregate([
        /// Match Filter
        {
            $match: filter
        },
        /// Add Fields
        {
            $addFields: {
                gameNumberBeforeX: {
                    $let: {
                        vars: {
                            gameNumberBeforeX: {
                                $regexFind: {
                                    input: "$gameNumber",
                                    regex: /^([0-9]+)/
                                }
                            }
                        },
                        in: "$$gameNumberBeforeX.match"
                    }
                },
                gameNumberAfterX: {
                    $let: {
                        vars: {
                            gameNumberAfterX: {
                                $regexFind: {
                                    input: "$gameNumber",
                                    regex: /X(.*)$/
                                }
                            }
                        },
                        in: { $substr: ["$$gameNumberAfterX.match", 1, -1] }
                    }
                },
                isTriplePama: {
                    $regexMatch: { input: { $substr: ["$gameNumberAfterX", 1, -1] }, regex: /(\d)\1\1/ }
                },
                isDoublePana: { $regexMatch: { input: { $substr: ["$gameNumberAfterX", 1, -1] }, regex: /(\d)\1/ } }
            }
        },
        /// Rate Lookup from gamerates
        {
            $lookup: {
                from: "gamerates",
                let: {
                    gameId: "$gameId",
                    gameRateType: "$gameRateType",
                    gameNumber: "$gameNumber"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: ["$gameId", "$$gameId"]
                                    },
                                    {
                                        $switch: {
                                            branches: [
                                                {
                                                    case: {
                                                        $and: [
                                                            { $in: [gameSession, ["OPEN-ALL", "CLOSE-ALL"]] },
                                                            {
                                                                $in: [
                                                                    "$$gameRateType",
                                                                    ["JODI", "JODI CYCLE", "HALF SANGAM"]
                                                                ]
                                                            },
                                                            { $eq: [{ $strLenCP: "$$gameNumber" }, 2] }
                                                        ]
                                                    },
                                                    then: {
                                                        $eq: ["$gameType", "DIGIT"]
                                                    }
                                                },
                                                {
                                                    case: {
                                                        $and: [
                                                            { $in: [gameSession, ["OPEN-ALL", "CLOSE-ALL"]] },
                                                            {
                                                                $in: [
                                                                    "$$gameRateType",
                                                                    ["JODI", "JODI CYCLE", "HALF SANGAM"]
                                                                ]
                                                            },
                                                            { $eq: [{ $substrCP: ["$$gameNumber", 1, 1] }, "X"] },
                                                            {
                                                                $eq: [
                                                                    {
                                                                        $strLenCP: {
                                                                            $substrCP: ["$$gameNumber", 0, 1]
                                                                        }
                                                                    },
                                                                    1
                                                                ]
                                                            }
                                                        ]
                                                    },
                                                    then: {
                                                        $eq: ["$gameType", "DIGIT"]
                                                    }
                                                },
                                                {
                                                    case: {
                                                        $and: [
                                                            { $in: [gameSession, ["OPEN-ALL", "CLOSE-ALL"]] },
                                                            { $in: ["$$gameRateType", ["HALF SANGAM"]] }
                                                        ]
                                                    },
                                                    then: {
                                                        //$eq: ["$gameType", "SINGLE PANA"]
                                                        $switch: {
                                                            branches: [
                                                                /// Cheking [ HALF SANGAM ] 1X122
                                                                // {
                                                                //     case: {
                                                                //         $and: [
                                                                //             { $eq: [gameSession, "OPEN-ALL"] },
                                                                //             { $eq: [{ $strLenCP: "$$gameNumber", }, 5] },
                                                                //             { $eq: [{ $substrCP: ["$$gameNumber", 1, 1] }, "X"] },

                                                                //         ]
                                                                //     },
                                                                //     then: {
                                                                //         $cond: {
                                                                //             if: { $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1\1/ } }, // Three digits are the same
                                                                //             then: { $eq: ["$gameType", "TRIPLE PANA"] },
                                                                //             else: {
                                                                //                 $cond: {
                                                                //                     if: { $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1/ } }, // Two  digits are the same
                                                                //                     then: { $eq: ["$gameType", "DOUBLE PANA"] },
                                                                //                     else: { $eq: ["$gameType", "SINGLE PANA"] } // Default amount if condition doesn't match
                                                                //                 }
                                                                //             }
                                                                //         }
                                                                //     }
                                                                // },
                                                                /// Cheking  [ HALF SANGAM ] 222X1
                                                                {
                                                                    case: {
                                                                        $and: [
                                                                            { $eq: [gameSession, "OPEN-ALL"] },
                                                                            {
                                                                                $eq: [{ $strLenCP: "$$gameNumber" }, 5]
                                                                            },
                                                                            {
                                                                                $eq: [
                                                                                    {
                                                                                        $substrCP: ["$gameNumber", 3, 1]
                                                                                    },
                                                                                    "X"
                                                                                ]
                                                                            },
                                                                            {
                                                                                $eq: [
                                                                                    {
                                                                                        $strLenCP: {
                                                                                            $substrCP: [
                                                                                                "$$gameNumber",
                                                                                                1,
                                                                                                4
                                                                                            ]
                                                                                        }
                                                                                    },
                                                                                    3
                                                                                ]
                                                                            }
                                                                        ]
                                                                    },
                                                                    then: {
                                                                        $cond: {
                                                                            if: {
                                                                                $regexMatch: {
                                                                                    input: "$gameNumberBeforeX",
                                                                                    regex: /(\d)\1\1/
                                                                                }
                                                                            }, // Three digits are the same
                                                                            then: {
                                                                                $eq: ["$gameType", "TRIPLE PANA"]
                                                                            },
                                                                            else: {
                                                                                $cond: {
                                                                                    if: {
                                                                                        $regexMatch: {
                                                                                            input: "$gameNumberBeforeX",
                                                                                            regex: /(\d)\1/
                                                                                        }
                                                                                    }, // Two digits are the same
                                                                                    then: {
                                                                                        $eq: [
                                                                                            "$gameType",
                                                                                            "DOUBLE PANA"
                                                                                        ]
                                                                                    },
                                                                                    else: {
                                                                                        $eq: [
                                                                                            "$gameType",
                                                                                            "SINGLE PANA"
                                                                                        ]
                                                                                    } // Default amount if condition doesn't match
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                },
                                                                {
                                                                    case: {
                                                                        $and: [
                                                                            { $eq: [gameSession, "CLOSE-ALL"] },
                                                                            {
                                                                                $eq: [{ $strLenCP: "$$gameNumber" }, 5]
                                                                            },
                                                                            {
                                                                                $eq: [
                                                                                    {
                                                                                        $substrCP: ["$gameNumber", 3, 1]
                                                                                    },
                                                                                    "X"
                                                                                ]
                                                                            },
                                                                            {
                                                                                $eq: [
                                                                                    {
                                                                                        $strLenCP: {
                                                                                            $substrCP: [
                                                                                                "$$gameNumber",
                                                                                                1,
                                                                                                4
                                                                                            ]
                                                                                        }
                                                                                    },
                                                                                    3
                                                                                ]
                                                                            }
                                                                        ]
                                                                    },
                                                                    then: { $eq: ["$gameType", "SINGLE PANA"] }
                                                                }
                                                            ],
                                                            default: { $eq: ["$gameType", "SINGLE PANA"] }
                                                        }
                                                    }
                                                }
                                            ],
                                            default: {
                                                $eq: ["$gameType", "$$gameRateType"]
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ],
                as: "gamerates"
            }
        },
        /// Add Fields
        {
            $addFields: {
                gameRateAmount: {
                    $arrayElemAt: ["$gamerates.gamePrice", 0]
                },
                gameNumberBeforeX: {
                    $let: {
                        vars: {
                            gameNumberBeforeX: {
                                $regexFind: {
                                    input: "$gameNumber",
                                    regex: /^([0-9]+)/
                                }
                            }
                        },
                        in: "$$gameNumberBeforeX.match"
                    }
                },
                gameNumberAfterX: {
                    $let: {
                        vars: {
                            gameNumberAfterX: {
                                $regexFind: {
                                    input: "$gameNumber",
                                    regex: /X(.+)/
                                }
                            }
                        },
                        in: { $substr: ["$$gameNumberAfterX.match", 1, -1] }
                    }
                }
            }
        },
        /// Group by GameType & GameNumber
        {
            $group: {
                _id: {
                    $concat: [
                        "$gameType",
                        "-",
                        {
                            $toString: {
                                $switch: {
                                    branches: [
                                        // JODI
                                        {
                                            case: {
                                                $and: [
                                                    { $eq: [gameSession, "OPEN-ALL"] },
                                                    { $eq: [{ $strLenCP: "$gameNumberBeforeX" }, 2] },
                                                    { $not: { $regexMatch: { input: "$gameNumber", regex: "X" } } }
                                                ]
                                            },
                                            then: { $substrCP: ["$gameNumberBeforeX", 0, 1] }
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    { $eq: [gameSession, "CLOSE-ALL"] },
                                                    { $eq: [{ $strLenCP: "$gameNumberAfterX" }, 2] },
                                                    { $not: { $regexMatch: { input: "$gameNumber", regex: "X" } } }
                                                ]
                                            },
                                            then: { $substrCP: ["$gameNumberAfterX", 1, 2] }
                                        },
                                        /// HALF SANGAM
                                        {
                                            case: {
                                                $and: [
                                                    { $eq: [gameSession, "OPEN-ALL"] },
                                                    { $eq: ["$gameType", "OPEN HALF SANGAM"] }
                                                ]
                                            },
                                            then: "$gameNumberBeforeX"
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    { $eq: [gameSession, "CLOSE-ALL"] },
                                                    { $eq: ["$gameType", "CLOSE HALF SANGAM"] }
                                                ]
                                            },
                                            then: "$gameNumberBeforeX"
                                        },
                                        /// TEMP
                                        {
                                            case: { $eq: [gameSession, "OPEN-ALL"] },
                                            then: {
                                                $cond: {
                                                    if: { $eq: [{ $strLenCP: "$gameNumber" }, 2] },
                                                    then: {
                                                        $substr: [
                                                            "$gameNumber",
                                                            0,
                                                            { $subtract: [{ $strLenCP: "$gameNumber" }, 1] }
                                                        ]
                                                    },
                                                    else: {
                                                        $let: {
                                                            vars: {
                                                                regexResult: {
                                                                    $regexFind: {
                                                                        input: "$gameNumber",
                                                                        regex: /(.+)X/
                                                                    }
                                                                }
                                                            },
                                                            in: {
                                                                $ifNull: [
                                                                    { $arrayElemAt: ["$$regexResult.captures", 0] },
                                                                    "$gameNumber"
                                                                ]
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    { $eq: [gameSession, "CLOSE-ALL"] },
                                                    { $eq: ["$resultStatus", "PENDING"] },
                                                    {
                                                        $ne: [
                                                            "$gameType",
                                                            [
                                                                "JODI",
                                                                "OPEN HALF SANGAM",
                                                                "CLOSE HALF SANGAM",
                                                                "FULL SANGAM"
                                                            ]
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: {
                                                $cond: {
                                                    if: { $eq: [{ $strLenCP: "$gameNumber" }, 2] },
                                                    then: {
                                                        $substr: [
                                                            "$gameNumber",
                                                            1,
                                                            { $subtract: [{ $strLenCP: "$gameNumber" }, 1] }
                                                        ]
                                                    },
                                                    else: {
                                                        $let: {
                                                            vars: {
                                                                regexResult: {
                                                                    $regexFind: {
                                                                        input: "$gameNumber",
                                                                        regex: /X(.*)$/
                                                                    }
                                                                }
                                                            },
                                                            in: {
                                                                $ifNull: [
                                                                    { $arrayElemAt: ["$$regexResult.captures", 0] },
                                                                    "$gameNumber"
                                                                ]
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    ],
                                    default: "$gameNumber"
                                }
                            }
                        }
                    ]
                },
                documents: {
                    $addToSet: "$$ROOT"
                }
            }
        },
        ///
        // {
        //     $group: {
        //         // _id: "$gameNumber",
        //         _id: {
        //             $cond: {
        //                 if: { $eq: [gameSession, "OPEN-ALL"] },
        //                 //then: null, // { $substr: ["$gameNumber", 0, 1] },
        //                 then: {
        //                     // $concat: [{ $toString: "$gameNumber" }, "-", { $toString: "$gameNumberBeforeX.match" }]

        //                     $cond: {
        //                         if: {
        //                             $eq: [
        //                                 {
        //                                     $strLenCP: "$gameNumber",
        //                                 },
        //                                 2,
        //                             ],
        //                         },
        //                         then: {
        //                             $substr: [
        //                                 "$gameNumber",
        //                                 0,
        //                                 {
        //                                     $subtract: [
        //                                         {
        //                                             $strLenCP: "$gameNumber",
        //                                         },
        //                                         1,
        //                                     ],
        //                                 },
        //                             ],
        //                         },
        //                         else: {
        //                             $let: {
        //                                 vars: {
        //                                     regexResult: {
        //                                         $regexFind: {
        //                                             input: "$gameNumber",
        //                                             regex: /(.+)X/,
        //                                         },
        //                                     },
        //                                 },
        //                                 in: {
        //                                     $ifNull: [
        //                                         {
        //                                             $arrayElemAt: [
        //                                                 "$$regexResult.captures",
        //                                                 0,
        //                                             ],
        //                                         },
        //                                         "$gameNumber",
        //                                     ],
        //                                 },
        //                             },
        //                         },
        //                     },

        //                 },
        //                 else: "$gameNumber"

        //             }
        //             // $switch: {
        //             //     branches: [
        //             //         {
        //             //             case: { $eq: [gameSession, "OPEN-ALL"] },
        //             //             then: {
        //             //                 $cond: {
        //             //                     if: { $eq: [{ $strLenCP: "$gameNumber", }, 2] },
        //             //                     then: { $substr: ["$gameNumber", 0, { $subtract: [{ $strLenCP: "$gameNumber", }, 1] }] },
        //             //                     else: {
        //             //                         $let: {
        //             //                             vars: { regexResult: { $regexFind: { input: "$gameNumber", regex: /(.+)X/ } } },
        //             //                             in: { $ifNull: [{ $arrayElemAt: ["$$regexResult.captures", 0], }, "$gameNumber"] },
        //             //                         }
        //             //                     },
        //             //                 }
        //             //             },
        //             //         },
        //             //         {
        //             //             case: {
        //             //                 $and: [
        //             //                     { $eq: [gameSession, "CLOSE-ALL"] },
        //             //                     { $eq: ["$resultStatus", "PENDING"] },
        //             //                     {
        //             //                         $ne: ["$gameType", ["JODI", "OPEN HALF SANGAM",
        //             //                             "CLOSE HALF SANGAM", "FULL SANGAM"]]
        //             //                     },
        //             //                 ]
        //             //             },
        //             //             then: {
        //             //                 $cond: {
        //             //                     if: { $eq: [{ $strLenCP: "$gameNumber", }, 2] },
        //             //                     then: { $substr: ["$gameNumber", 1, { $subtract: [{ $strLenCP: "$gameNumber", }, 1] }] },
        //             //                     else: {
        //             //                         $let: {
        //             //                             vars: { regexResult: { $regexFind: { input: "$gameNumber", regex: /X(.*)$/ } } },
        //             //                             in: { $ifNull: [{ $arrayElemAt: ["$$regexResult.captures", 0], }, "$gameNumber"] },
        //             //                         }
        //             //                     },
        //             //                 }
        //             //             },
        //             //         },

        //             //     ],
        //             //     default: "$gameNumber",
        //             // },
        //         },
        //         totalBids: {
        //             $addToSet: "$$ROOT"
        //         },
        //         gameRateAmount: {
        //             $addToSet: {
        //                 $arrayElemAt: ["$gamerates.gamePrice", 0]
        //             }
        //         },
        //         totalBidsAmount: {

        //             $sum: {
        //                 // $cond: {
        //                 //     if: { $eq: [gameSession, "CLOSE-ALL"], },
        //                 //     then: { $divide: [{ $multiply: ["$gameAmount", { $arrayElemAt: ["$gamerates.gamePrice", 0] }] }, 10] }, // Condition is true
        //                 //     else: "$gameAmount" // Condition is false
        //                 // }

        //                 $switch: {
        //                     branches: [

        //                         /// Cheking [ HALF SANGAM ] 1X122
        //                         {
        //                             case: {
        //                                 $and: [
        //                                     { $eq: [gameSession, "OPEN-ALL"] },
        //                                     { $eq: [{ $strLenCP: "$gameNumber", }, 5] },
        //                                     { $eq: [{ $substrCP: ["$gameNumber", 1, 1] }, "X"] },

        //                                 ]
        //                             },
        //                             then: {
        //                                 $cond: {
        //                                     if: { $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1\1/ } }, // Three digits are the same
        //                                     then: { $divide: ["$gameAmount", 4] },
        //                                     else: {
        //                                         $cond: {
        //                                             if: { $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1/ } }, // Two  digits are the same
        //                                             then: { $divide: ["$gameAmount", 2] },
        //                                             else: "$gameAmount" // Default amount if condition doesn't match
        //                                         }
        //                                     }
        //                                 }
        //                             }
        //                         },
        //                         /// Cheking  [ HALF SANGAM ] 222X1
        //                         {
        //                             case: {
        //                                 $and: [
        //                                     { $eq: [gameSession, "OPEN-ALL"] },
        //                                     { $eq: [{ $strLenCP: "$gameNumber", }, 5] },
        //                                     { $eq: [{ $substrCP: ["$gameNumber", 3, 1] }, "X"] },

        //                                 ]
        //                             },
        //                             then: {
        //                                 $cond: {
        //                                     if: { $regexMatch: { input: "$gameNumberBeforeX", regex: /(\d)\1\1/ } }, // Three digits are the same
        //                                     then: { $divide: ["$gameAmount", 4] },
        //                                     else: {
        //                                         $cond: {
        //                                             if: { $regexMatch: { input: "$gameNumberBeforeX", regex: /(\d)\1/ } }, // Two digits are the same
        //                                             then: { $divide: ["$gameAmount", 2] },
        //                                             else: "$gameAmount" // Default amount if condition doesn't match
        //                                         }
        //                                     }
        //                                 }
        //                             }
        //                         },
        //                         // Cheking [ FULL SANGAM ]  235X100 [ TP X (SP,DP,TP) ]
        //                         {
        //                             case: {
        //                                 $and: [
        //                                     { $eq: [gameSession, "OPEN-ALL"] },
        //                                     { $eq: [{ $strLenCP: "$gameNumber", }, 7] },
        //                                     { $eq: [{ $substrCP: ["$gameNumber", 3, 1] }, "X"] },
        //                                     { $regexMatch: { input: "$gameNumberBeforeX", regex: /(\d)\1\1/ } }
        //                                 ]
        //                             },
        //                             then: { $divide: ["$gameAmount", 4] }
        //                         },
        //                         /// Cheking [ FULL SANGAM ]  235X100 [ DP X (SP,DP,TP) ]
        //                         {
        //                             case: {
        //                                 $and: [
        //                                     { $eq: [gameSession, "OPEN-ALL"] },
        //                                     { $eq: [{ $strLenCP: "$gameNumber", }, 7] },
        //                                     { $eq: [{ $substrCP: ["$gameNumber", 3, 1] }, "X"] },
        //                                     { $regexMatch: { input: "$gameNumberBeforeX", regex: /(\d)\1/ } }
        //                                 ]
        //                             },
        //                             then: {
        //                                 $switch: {
        //                                     branches: [
        //                                         {
        //                                             case: { $regexMatch: { "input": "$gameNumberAfterX", "regex": /(\d)\1\1/ } }, // Three digits are the same
        //                                             then: { $divide: ["$gameAmount", 4] }
        //                                         },
        //                                         {
        //                                             case: { $regexMatch: { "input": "$gameNumberAfterX", "regex": /(\d)\1/ } }, // Two digits are the same
        //                                             then: { $divide: ["$gameAmount", 4] }
        //                                         },
        //                                         {
        //                                             case: { $regexMatch: { "input": "$gameNumberAfterX", "regex": /^(?!.*(.).*\1).*$/ } }, // all are the diffrent
        //                                             then: { $divide: ["$gameAmount", 2] }
        //                                         }
        //                                     ],
        //                                     default: "$gameAmount" // Default amount if condition doesn't match
        //                                 }

        //                             }
        //                         },
        //                         // Cheking [ FULL SANGAM ]  235X100 [SP  X (SP,DP,TP) ]
        //                         {
        //                             case: {
        //                                 $and: [
        //                                     { $eq: [gameSession, "OPEN-ALL"] },
        //                                     { $eq: [{ $strLenCP: "$gameNumber", }, 7] },
        //                                     { $eq: [{ $substrCP: ["$gameNumber", 3, 1] }, "X"] },
        //                                     {
        //                                         $regexMatch: {
        //                                             input: "$gameNumberBeforeX", regex: /^(?!.*(.).*\1).*$/
        //                                         }
        //                                     }
        //                                 ]
        //                             },
        //                             then: {
        //                                 $cond: {
        //                                     if: { $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1\1/ } }, // Three digits are the same
        //                                     then: { $divide: ["$gameAmount", 4] },
        //                                     else: {
        //                                         $cond: {
        //                                             if: { $regexMatch: { input: "$gameNumberAfterX", regex: /(\d)\1/ } }, // Two digits are the same
        //                                             then: { $divide: ["$gameAmount", 2] },
        //                                             else: "$gameAmount" // Default amount if condition doesn't match
        //                                         }
        //                                     }
        //                                 }
        //                             }
        //                         },
        //                         /// <----- CLOSE ALL [ HALF-SANGAM ] -----> ///
        //                         /// (I). CHECK FOR [ OPEN X (SP,DP,TP)] -> 1X123
        //                         {
        //                             case: {
        //                                 $and: [
        //                                     { $eq: [gameSession, "CLOSE-ALL"] },
        //                                     { $eq: [{ $strLenCP: "$gameNumber", }, 5] },
        //                                     { $eq: [{ $substrCP: ["$gameNumber", 1, 1] }, "X"] },

        //                                 ]
        //                             },
        //                             then: {
        //                                 $switch: {
        //                                     branches: [
        //                                         {
        //                                             case: { $regexMatch: { "input": "$gameNumberAfterX", "regex": /(\d)\1\1/ } }, // Three digits are the same
        //                                             then: { $multiply: ["$gameAmount", 2.5] }
        //                                         },
        //                                         {
        //                                             case: { $regexMatch: { "input": "$gameNumberAfterX", "regex": /(\d)\1/ } }, // Two digits are the same
        //                                             then: { $multiply: ["$gameAmount", 5] }
        //                                         },
        //                                         {
        //                                             case: { $regexMatch: { "input": "$gameNumberAfterX", "regex": /^(?!.*(.).*\1).*$/ } }, // all are the diffrent
        //                                             then: { $multiply: ["$gameAmount", 10] }
        //                                         }
        //                                     ],
        //                                     default: "$gameAmount" // Default amount if condition doesn't match
        //                                 }
        //                             }
        //                         },
        //                         /// (II). CHECK FOR [ (SP,DP,TP) X CLOSE ] -> 123X1
        //                         {
        //                             case: {
        //                                 $and: [
        //                                     { $eq: [gameSession, "CLOSE-ALL"] },
        //                                     { $eq: [{ $strLenCP: "$gameNumber", }, 5] },
        //                                     { $eq: [{ $substrCP: ["$gameNumber", 3, 1] }, "X"] },

        //                                 ]
        //                             },
        //                             then: { $multiply: ["$gameAmount", { $arrayElemAt: ["$gamerates.gamePrice", 0] }] }
        //                         },
        //                         /// <----- CLOSE ALL [ FULL-SANGAM ] -----> ///
        //                         /// (I). CHECK FOR [ SP X (TP,DP,SP)]
        //                         {
        //                             case: {
        //                                 $and: [
        //                                     { $eq: [gameSession, "CLOSE-ALL"] },
        //                                     { $eq: [{ $strLenCP: "$gameNumber", }, 7] },
        //                                     { $eq: [{ $substrCP: ["$gameNumber", 3, 1] }, "X"] },
        //                                 ]
        //                             },
        //                             then: {
        //                                 $switch: {
        //                                     branches: [
        //                                         {
        //                                             case: { $regexMatch: { "input": "$gameNumberAfterX", "regex": /(\d)\1\1/ } }, // Three digits are the same
        //                                             then: { $multiply: ["$gameAmount", 50] }
        //                                         },
        //                                         {
        //                                             case: { $regexMatch: { "input": "$gameNumberAfterX", "regex": /(\d)\1/ } }, // Two digits are the same
        //                                             then: { $multiply: ["$gameAmount", 75] }
        //                                         },
        //                                         {
        //                                             case: { $regexMatch: { "input": "$gameNumberAfterX", "regex": /^(?!.*(.).*\1).*$/ } }, // all are the diffrent
        //                                             then: { $multiply: ["$gameAmount", 150] }
        //                                         }
        //                                     ],
        //                                     default: "$gameAmount" // Default amount if condition doesn't match
        //                                 }
        //                             }
        //                         },
        //                         /// Cheking [ JODI  ] 22
        //                         {
        //                             case: {
        //                                 $and: [
        //                                     { $eq: [gameSession, "CLOSE-ALL"] },
        //                                     { $eq: [{ $strLenCP: "$gameNumber", }, 2] },
        //                                     { $not: { $regexMatch: { input: "$gameNumber", regex: "X" } } }
        //                                 ]
        //                             },
        //                             then: { $multiply: ["$gameAmount", { $arrayElemAt: ["$gamerates.gamePrice", 0] }] }
        //                         },

        //                     ],
        //                     /// By Default SP for [ HALF SANGAM ], SPXSP [ FULL SANGAM ]
        //                     default: "$gameAmount",
        //                 },
        //             }
        //         }
        //     }
        // },
        // {
        //     $addFields: {
        //         gameNumber: "$_id",
        //         totalBidsAmount: "$totalBidsAmount",
        //         gameRateAmount: {
        //             $arrayElemAt: ["$gameRateAmount", 0]
        //         },
        //         gameId: {
        //             $arrayElemAt: ["$totalBids.gameId", 0]
        //         },
        //         gameSession: {
        //             $arrayElemAt: ["$totalBids.gameSession", 0]
        //         },
        //         resultStatus: {
        //             $arrayElemAt: ["$totalBids.resultStatus", 0]
        //         },
        //         gameType: {
        //             $arrayElemAt: ["$totalBids.gameType", 0]
        //         },
        //         gameNumberBeforeX: {
        //             $arrayElemAt: ["$totalBids.gameNumberBeforeX", 0]
        //         },
        //         gameNumberAfterX: {
        //             $arrayElemAt: ["$totalBids.gameNumberAfterX", 0]
        //         },
        //         totalBids: "$totalBids"
        //     }
        // },
        // {
        //     $project: {
        //         _id: 0,
        //         gameId: 1,
        //         gameNumber: 1,
        //         gameNumberBeforeX: 1,
        //         gameNumberAfterX: 1,
        //         gameRateAmount: 1,
        //         // gameNumberBeforeX: { $arrayElemAt: [{ $split: ["$$ROOT.gameNumber", "-"] }, 1] },
        //         totalBidsAmount: 1,
        //         gameType: 1,
        //         gameSession: 1,
        //         gameType: 1,
        //         resultStatus: 1,
        //         totalAmountToPay: {
        //             $multiply: [
        //                 {
        //                     $toDouble: "$totalBidsAmount"
        //                 },
        //                 {
        //                     $toDouble: "$gameRateAmount"
        //                 }
        //             ]
        //         }
        //     }
        // },
        // {
        //     $facet: {
        //         totalBidsAmountSum: [
        //             {
        //                 $group: {
        //                     _id: "$gameType",
        //                     // _id: {
        //                     //     $cond: {
        //                     //         if: { $eq: [gameSession, "OPEN-ALL1"] },
        //                     //         //then: null, // { $substr: ["$gameNumber", 0, 1] },
        //                     //         then: {
        //                     //             $concat: [
        //                     //                 { $toString: "$gameType" },
        //                     //                 "-",
        //                     //                 { $toString: "$gameNumberBeforeX" }
        //                     //             ]
        //                     //         },
        //                     //         else: "$gameType"
        //                     //     }
        //                     // },
        //                     totalBidsAmountAll: {
        //                         $sum: "$totalBidsAmount"
        //                     }
        //                 }
        //             }
        //         ],
        //         documents: [
        //             {
        //                 $project: {
        //                     _id: 0
        //                 }
        //             }
        //         ]
        //     }
        // },
        /// unwind documents
        {
            $unwind: "$documents"
        },
        // {
        //     $group: {
        //         _id: {
        //             $concat: [
        //                 "$totalBids.gameType",
        //                 "-",
        //                 "$_id"
        //             ]
        //         },
        //         documents: {
        //             $addToSet: "$$ROOT"
        //         }
        //     }
        // }
        /// Add Fields
        {
            $addFields: {
                newGameRate: "$documents.gameRateAmount",
                newTotalAmoutToPay: {
                    $multiply: [
                        {
                            $toDouble: "$documents.gameAmount"
                        },
                        {
                            $toDouble: "$documents.gameRateAmount"
                        }
                    ]
                }
            }
        },
        /// project data
        {
            $project: {
                gameNumber: {
                    $switch: {
                        branches: [
                            {
                                case: { $in: [gameSession, ["OPEN-ALL", "CLOSE-ALL"]] },
                                then: {
                                    $concat: [
                                        {
                                            $toString: {
                                                $arrayElemAt: [{ $split: ["$_id", "-"] }, 1]
                                            }
                                        },
                                        "X"
                                    ]
                                }
                            }
                        ],
                        default: { $arrayElemAt: [{ $split: ["$documents.gameNumber", "-"] }, 1] }
                    }
                },
                gameId: "$documents.gameId",
                gameNumberBeforeX: "$documents.gameNumberBeforeX",
                gameNumberAfterX: "$documents.gameNumberAfterX",
                gameRateAmount: "$documents.gameRateAmount",
                totalBidsAmount: "$documents.gameAmount",
                gameSession: "$documents.gameSession",
                resultStatus: "$documents.resultStatus",
                gameNumberBeforeX: "$documents.gameNumberBeforeX",
                gameType: "$documents.gameType",
                totalAmountToPay: "$newTotalAmoutToPay",
                winAmount: {
                    $cond: {
                        if: { $lt: ["$newTotalAmoutToPay", "$newTotalBidsAmountSum"] },
                        then: { $subtract: ["$newTotalBidsAmountSum", "$newTotalAmoutToPay"] },
                        else: 0
                    }
                },
                lossAmount: {
                    $cond: {
                        if: { $gt: ["$newTotalAmoutToPay", "$newTotalBidsAmountSum"] },
                        then: { $subtract: ["$newTotalAmoutToPay", "$newTotalBidsAmountSum"] },
                        else: 0
                    }
                },

                totalBidsAmountSum: "$newTotalBidsAmountSum",
                babutotalBidsAmountAll: "$totalBidsAmountSum"
                // babuIndex: {
                //     $indexOfArray: [
                //         "$totalBidsAmountSum._id",
                //         "$documents.gameType"
                //         // { $concat: ["$documents.gameType", "-", "$documents.gameNumberBeforeX"] }
                //     ]
                // }
            }
        }
        // ...(gameSession == "OPEN-ALL" || (gameSession == "CLOSE-ALL" && game.resultDeclareDate != null)
        //     ? [
        //         {
        //             $match: gameSession == "CLOSE-ALL" ? { "resultStatus": "PENDING" } : {}
        //         },
        //         // {
        //         //     $addFields: {
        //         //         SSSSS: "$resultStatus"
        //         //     },
        //         // },
        //         {
        //             $group: {
        //                 _id: {
        //                     $strLenCP: "$gameNumber",
        //                 },
        //                 totalBidsAmountSum: {
        //                     $sum: "$totalBidsAmount",
        //                 },
        //                 documents: {
        //                     $push: "$$ROOT"
        //                 }
        //             },
        //         },
        //         {
        //             $unwind: {
        //                 path: "$documents",
        //                 preserveNullAndEmptyArrays: true
        //             }
        //         },
        //         {
        //             $lookup: {
        //                 from: "gamerates",
        //                 let: {
        //                     "gameId": "$documents.gameId",
        //                     "gameNumber": "$documents.gameNumber",
        //                     "gameRateType": "$documents.gameType",
        //                     "gameNumberAfterX": "$documents.gameNumberAfterX",
        //                     "gameNumberBeforeX": "$documents.gameNumberBeforeX",
        //                 },
        //                 pipeline: [
        //                     {
        //                         $match: {
        //                             $expr: {
        //                                 $and: [
        //                                     {
        //                                         $eq: ["$gameId", "$$gameId"]
        //                                     },
        //                                     {
        //                                         $switch: {
        //                                             branches: [
        //                                                 {
        //                                                     case: {
        //                                                         $and: [
        //                                                             { $in: [gameSession, ["OPEN-ALL", "CLOSE-ALL", "OPEN"]] },
        //                                                             {
        //                                                                 $or: [
        //                                                                     { $eq: [{ $strLenCP: "$$gameNumber" }, 2] },
        //                                                                     { $eq: [{ $strLenCP: "$$gameNumber" }, 2] },
        //                                                                 ]
        //                                                             },
        //                                                             {
        //                                                                 $in: ["$$gameRateType", ["OPEN", "JODI", "JODI CYCLE", "RED HALF", "RED FULL",
        //                                                                     "ODD EVEN", "FAMILY", "OPEN HALF SANGAM", "CLOSE HALF SANGAM"]]
        //                                                             },
        //                                                             {
        //                                                                 $or: [
        //                                                                     { $eq: [{ $strLenCP: { $substrCP: ["$$gameNumber", 0, 1] } }, 1] },
        //                                                                     { $eq: [{ $strLenCP: "$$gameNumberAfterX" }, 1] },

        //                                                                 ]
        //                                                             }
        //                                                         ]
        //                                                     },
        //                                                     then: {
        //                                                         $eq: ["$gameType", "DIGIT"]
        //                                                     }
        //                                                 },
        //                                                 {
        //                                                     case: {
        //                                                         $and: [
        //                                                             { $in: [gameSession, ["OPEN-ALL", "CLOSE-ALL", "OPEN"]] },
        //                                                             {
        //                                                                 $in: ["$$gameRateType", ["OPEN PANA", "OPEN HALF SANGAM",
        //                                                                     "CLOSE HALF SANGAM", "FULL SANGAM",
        //                                                                     "SP MOTOR", "DP MOTOR", "SP DP TP", "PANEL GROUP",
        //                                                                     "TWO DIGIT PANA (CP,SR)", "CHOICE PANA"]]
        //                                                             }
        //                                                         ]
        //                                                     },
        //                                                     then: {
        //                                                         $switch: {
        //                                                             branches: [
        //                                                                 {
        //                                                                     case: { $or: [{ $eq: [gameSession, "OPEN-ALL"] }, { $eq: [gameSession, "CLOSE-ALL"] }] },
        //                                                                     then: {
        //                                                                         $cond: {
        //                                                                             if: { $regexMatch: { input: "$$gameNumber", regex: /(\d)\1\1/ } }, // Three digits are the same
        //                                                                             then: { $eq: ["$gameType", "TRIPLE PANA"] },
        //                                                                             else: {
        //                                                                                 $cond: {
        //                                                                                     if: { $regexMatch: { input: "$$gameNumber", regex: /(\d)\1/ } }, // Two  digits are the same
        //                                                                                     then: { $eq: ["$gameType", "DOUBLE PANA"] },
        //                                                                                     else: { $eq: ["$gameType", "SINGLE PANA"] } // Default amount if condition doesn't match
        //                                                                                 }
        //                                                                             }
        //                                                                         }
        //                                                                     }
        //                                                                 },
        //                                                                 // {
        //                                                                 //     case: { $and: [{ $eq: [gameSession, "CLOSE-ALL"] }] },
        //                                                                 //     then: {
        //                                                                 //         $cond: {
        //                                                                 //             if: { $regexMatch: { input: "$$gameNumberBeforeX", regex: /(\d)\1\1/ } }, // Three digits are the same
        //                                                                 //             then: { $eq: ["$gameType", "TRIPLE PANA"] },
        //                                                                 //             else: {
        //                                                                 //                 $cond: {
        //                                                                 //                     if: { $regexMatch: { input: "$$gameNumberBeforeX", regex: /(\d)\1/ } }, // Two  digits are the same
        //                                                                 //                     then: { $eq: ["$gameType", "DOUBLE PANA"] },
        //                                                                 //                     else: { $eq: ["$gameType", "SINGLE PANA"] } // Default amount if condition doesn't match
        //                                                                 //                 }
        //                                                                 //             }
        //                                                                 //         }
        //                                                                 //     }
        //                                                                 // },
        //                                                                 // {
        //                                                                 //     case: { $and: [{ $eq: [gameSession, "CLOSE-ALL"] }] },
        //                                                                 //     then: {
        //                                                                 //         $cond: {
        //                                                                 //             if: { $regexMatch: { input: "$$gameNumberAfterX", regex: /(\d)\1\1/ } }, // Three digits are the same
        //                                                                 //             then: { $eq: ["$gameType", "TRIPLE PANA"] },
        //                                                                 //             else: {
        //                                                                 //                 $cond: {
        //                                                                 //                     if: { $regexMatch: { input: "$$gameNumberAfterX", regex: /(\d)\1/ } }, // Two  digits are the same
        //                                                                 //                     then: { $eq: ["$gameType", "DOUBLE PANA"] },
        //                                                                 //                     else: { $eq: ["$gameType", "SINGLE PANA"] } // Default amount if condition doesn't match
        //                                                                 //                 }
        //                                                                 //             }
        //                                                                 //         }
        //                                                                 //     }
        //                                                                 // },

        //                                                             ],
        //                                                             default: { $eq: ["$gameType", "SINGLE PANA"] }
        //                                                         }
        //                                                     }
        //                                                 }
        //                                             ],
        //                                             default: {
        //                                                 $eq: ["$gameType", "$$gameRateType"]
        //                                             }
        //                                         }
        //                                     }

        //                                 ]
        //                             }
        //                         }
        //                     }
        //                 ],
        //                 as: "gamerates"
        //             }
        //         },
        //         {
        //             $addFields: {
        //                 gameRateType: "$documents.gameType",
        //                 newGameRate: { $arrayElemAt: ["$gamerates.gamePrice", 0] },
        //                 newTotalAmoutToPay: { $multiply: ["$documents.totalBidsAmount", { $arrayElemAt: ["$gamerates.gamePrice", 0] }] },
        //             }
        //         },
        //         {
        //             $project: {
        //                 "_id": 0,
        //                 "gameId": "$documents.gameId",
        //                 "totalBidsAmountSum": 1,
        //                 "gameNumber": "$documents.gameNumber",
        //                 "gameNumberBeforeX": "$documents.gameNumberBeforeX",
        //                 "gameNumberAfterX": "$documents.gameNumberAfterX",
        //                 "gameRateAmount": "$newGameRate",
        //                 "totalBidsAmount": "$documents.totalBidsAmount",
        //                 "gameSession": "$documents.gameSession",
        //                 "gameType": "$documents.gameType",
        //                 "totalAmountToPay": "$newTotalAmoutToPay",
        //                 "winAmount": {
        //                     $switch: {
        //                         branches: [
        //                             {
        //                                 case: {
        //                                     $lt: ["$newTotalAmoutToPay", "$totalBidsAmountSum"]
        //                                 }, then: {
        //                                     $subtract: ["$totalBidsAmountSum", "$newTotalAmoutToPay"]
        //                                 }

        //                             }
        //                         ],
        //                         default: 0
        //                     }
        //                 },
        //                 "lossAmount": {
        //                     $switch: {
        //                         branches: [
        //                             {
        //                                 case: {
        //                                     $gt: ["$newTotalAmoutToPay", "$totalBidsAmountSum"]
        //                                 }, then: {
        //                                     $subtract: ["$totalBidsAmountSum", "$newTotalAmoutToPay"]
        //                                 }

        //                             }
        //                         ],
        //                         default: 0
        //                     }
        //                 }
        //             }
        //         }
        //     ]
        //     : [])
    ]);

    // console.log(completeDetails);
    // console.log(filter);
    const modifiedFilter = { ...filter };

    delete modifiedFilter.gameType;
    delete modifiedFilter.gameSession;

    console.log(modifiedFilter);

    let summaryDetails = await Biding.aggregate([
        {
            $match: modifiedFilter
        },
        {
            $group: {
                _id: "$gameNumber",
                totalAmount: { $sum: "$gameAmount" },
                winAmount: { $sum: "$winAmount" }
            }
        },
        {
            $group: {
                _id: {
                    $cond: {
                        if: {
                            $and: [{ $regexMatch: { input: "$_id", regex: /X$/ } }, { $eq: [{ $strLenCP: "$_id" }, 2] }]
                        },
                        then: "OPEN",
                        else: {
                            $cond: {
                                if: {
                                    $and: [
                                        { $regexMatch: { input: "$_id", regex: /^X/ } },
                                        { $eq: [{ $strLenCP: "$_id" }, 2] }
                                    ]
                                },
                                then: "CLOSE",
                                else: {
                                    $cond: {
                                        if: {
                                            $and: [
                                                { $regexMatch: { input: "$_id", regex: /^[^XX]{2}$/ } },
                                                { $eq: [{ $strLenCP: "$_id" }, 2] }
                                            ]
                                        },
                                        then: "JODI",
                                        else: {
                                            $cond: {
                                                if: {
                                                    $and: [
                                                        { $regexMatch: { input: "$_id", regex: /^X|X$/ } },
                                                        { $eq: [{ $strLenCP: "$_id" }, 4] }
                                                    ]
                                                },
                                                then: "PANA",
                                                else: {
                                                    $cond: {
                                                        if: {
                                                            $and: [
                                                                {
                                                                    $regexMatch: {
                                                                        input: "$_id",
                                                                        regex: /^.{1}X|^.X|^.+X|^.+X/
                                                                    }
                                                                },
                                                                { $eq: [{ $strLenCP: "$_id" }, 5] }
                                                            ]
                                                        },
                                                        then: "HALF SANGAM",
                                                        else: {
                                                            $cond: {
                                                                if: {
                                                                    $and: [
                                                                        {
                                                                            $regexMatch: {
                                                                                input: "$_id",
                                                                                regex: /^.{3}X.{3}$/
                                                                            }
                                                                        },
                                                                        { $eq: [{ $strLenCP: "$_id" }, 7] }
                                                                    ]
                                                                },
                                                                then: "FULL SANGAM",
                                                                else: "OtherGroup"
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                totalAmount: { $sum: "$totalAmount" },
                totalWinAmount: { $sum: "$winAmount" },
                values: { $push: "$_id" }
            }
        },
        {
            $group: {
                _id: "$_id",
                totalAmount: { $first: "$totalAmount" },
                totalWinAmount: { $first: "$totalWinAmount" },
                values: { $push: "$values" }
            }
        },
        {
            $project: {
                _id: 0,
                type: "$_id",
                totalAmount: 1,
                totalWinAmount: 1,
                values: 1
            }
        }
    ]);

    return res.status(200).json(new ApiResponse(200, { completeDetails, summaryDetails }));
});
