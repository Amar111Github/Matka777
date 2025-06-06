import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose, { Schema } from "mongoose";
import moment from "moment-timezone";
import { Game, GameRates, GameResultModel, GameTimings, GameType } from "../models/gameModel.js";

import {
    GameCategoryEnums,
    GameRatesEnums,
    GameResultEnums,
    GameTypeEnums,
    TransactionPaymentEnums,
    TransactionTypeEnums,
    WeekDaysEnums
} from "../constants/constants.js";
import { sendNotifcationWithFirebase } from "../utils/notifications.js"
import { calculateDigitSum, calculateGameFinalResult, getLastDigit } from "../utils/gameLogicUtils.js";
import { Biding } from "../models/bidModel.js";
import { Transaction } from "../models/transModel.js";
import { Admin, User } from "../models/userModel.js";


export const getGames = asyncHandler(async (req, res) => {
    const { gameCategory, isPublic } = req.query;

    let filter = {};

    let date = new Date().toJSON();
    let todayDate = date.split("T")[0];

    if (gameCategory) {
        filter = {
            gameCategory: gameCategory
        };
    }

    try {

        if (isPublic) {
            const totalGames = await Game.find(filter).sort({ gameIndex: 1 });

            return res.status(200).json(new ApiResponse(200, totalGames));
        }

        const totalGames = await Game.aggregate([
            {
                $match: filter,
            },
            {
                $lookup: {
                    from: "bidings",
                    let: { gameId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$gameId", "$$gameId"] },
                                        { $eq: ["$resultStatus", "PENDING"] },
                                        { $gte: ["$createdAt", new Date(`${todayDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${todayDate}T23:59:59.999Z`)] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "bidings"
                }
            },
            {
                $project: {
                    gameId: "$_id",
                    gameDay: 1,
                    isOpen: 1,
                    gameCategory: 1,
                    openBidTime: 1,
                    closeBidTime: 1,
                    openBidResultTime: '$openWebResultTime',
                    closeBidResultTime: '$closeWebResultTime',
                    createdAt: 1,
                    updatedAt: 1,
                    gameIndex: 1,
                    gameName: 1,
                    gameCategory: 1,
                    openNumber: '$lastOpenNumber',
                    closeNumber: '$lastCloseNumber',
                    resultNumber: '$lastResultNumber',
                    guessingNumber: 1,
                    isGameActive: 1,
                    isOpenBidActive: 1,
                    isCloseBidActive: 1,
                    activeStatus: 1,
                    holidayStatus: 1,
                    highlightStatus: 1,
                    resultDeclareDate: 1,
                    isWebShow: 1,
                    isWebAnkShow: 1,
                    gameDayCount: 1,
                    gameExposure: {
                        $sum: "$bidings.gameAmount"
                    },
                    bidingsCount: { $size: "$bidings" }
                }
            },
            {
                $sort: {
                    gameIndex: 1
                }
            }
        ]);



        return res.status(200).json(new ApiResponse(200, totalGames));

    } catch (error) {
        console.error("Error fetching game:", error);
        throw new ApiError(500, "Error fetching game:" + error);
    }
});


/// Get Total Games
export const getTotalGames = asyncHandler(async (req, res) => {
    const { gameCategory, gameSetting, activeStatus, isPublic } = req.query;
    const currentDate = new Date();
    let date = new Date().toJSON();
    let todayDate = date.split("T")[0];

    const currentDayName = WeekDaysEnums[currentDate.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()];

    let filter = {
        gameDay: currentDayName,
        // isOpen: true
    };

    if (gameCategory) {
        filter = {
            gameCategory: gameCategory,
            gameDay: currentDayName,
            // isOpen: true
        };
    }
    if (gameCategory && !isPublic) {
        filter = {
            gameCategory: gameCategory,
            gameDay: currentDayName,
            isOpen: true
        };
    }

    if (req.url.includes("public")) {
        // filter.isWebShow = true;
    }


    try {
        let totalGames;

        if (isPublic) {
            totalGames = await GameTimings.aggregate([
                {
                    $match: filter
                },
                {
                    $lookup: {
                        from: "games",
                        localField: "gameId",
                        foreignField: "_id",
                        as: "gameDetails"
                    }
                },
                {
                    $unwind: {
                        path: "$gameDetails",
                        preserveNullAndEmptyArrays: true
                    }
                },
                ...(activeStatus
                    ? [
                        {
                            $match: {
                                "gameDetails.activeStatus": Boolean(activeStatus)
                            }
                        }
                    ]
                    : []),
                {
                    $addFields: {
                        /// "lt" stands for "less than .",
                        "currentIST": new Date(Date.now() + (330 * 60000)).toISOString().split('T')[1].split('.')[0],
                        "currentUTC": new Date().toISOString(),
                        'cuOpenBidTime': { $substr: ["$openBidTime", 11, 8] },
                        'cuCloseBidTime': { $substr: ["$closeBidTime", 11, 8] },
                        isGameActive: { $and: [{ $lt: [new Date(Date.now() + (330 * 60000)).toISOString().split('T')[1].split('.')[0], { $substr: ["$closeBidTime", 11, 8] }] }, { gameDay: currentDayName }] },
                        isOpenBidActive: { $and: [{ $lt: [new Date(Date.now() + (330 * 60000)).toISOString().split('T')[1].split('.')[0], { $substr: ["$openBidTime", 11, 8] }] }, { gameDay: currentDayName }] },
                        isCloseBidActive: {
                            $and: [{ $lt: [new Date(Date.now() + (330 * 60000)).toISOString().split('T')[1].split('.')[0], { $substr: ["$closeBidTime", 11, 8] }] }, { gameDay: currentDayName }]
                        }
                    }
                },
                {
                    $project: {
                        gameId: 1,
                        gameDay: 1,
                        isOpen: 1,
                        gameCategory: 1,
                        openBidTime: 1,
                        closeBidTime: 1,
                        openBidResultTime: 1,
                        closeBidResultTime: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        gameIndex: "$gameDetails.gameIndex",
                        gameName: "$gameDetails.gameName",
                        gameCategory: "$gameDetails.gameCategory",
                        openNumber: "$gameDetails.openNumber",
                        closeNumber: "$gameDetails.closeNumber",
                        resultNumber: "$gameDetails.resultNumber",
                        guessingNumber: "$gameDetails.guessingNumber",
                        isGameActive: 1,
                        isOpenBidActive: 1,
                        isCloseBidActive: 1,
                        activeStatus: "$gameDetails.activeStatus",
                        holidayStatus: "$gameDetails.holidayStatus",
                        highlightStatus: "$gameDetails.highlightStatus",
                        resultDeclareDate: "$gameDetails.resultDeclareDate",
                        isWebShow: "$gameDetails.isWebShow",
                        isWebAnkShow: "$gameDetails.isWebAnkShow",
                        gameDayCount: "$gameDetails.gameDayCount",
                    }
                },
                {
                    $sort: {
                        gameIndex: 1
                    }
                }
            ]);

        } else if (gameSetting) {
            totalGames = await GameTimings.aggregate([
                {
                    $match: { gameCategory }
                },
                {
                    $lookup: {
                        from: "games",
                        localField: "gameId",
                        foreignField: "_id",
                        as: "gameDetails"
                    }
                },
                {
                    $unwind: {
                        path: "$gameDetails",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        __v: 0,
                        "gameDetails.__v": 0
                    }
                },
                // {
                //     $sort: {
                //         createdAt: -1
                //     }
                // },
                {
                    $group: {
                        _id: "$gameId",
                        gameDetails: { $first: "$gameDetails" }, // Take the first 'gameDetails' document for each 'gameId'
                        gameTimings: { $push: "$$ROOT" } // Store all 'gameTimings' documents in an array
                    }
                },
                {
                    $project: {
                        _id: 0, // Exclude the '_id' field
                        gameDetails: 1,
                        gameTimings: 1
                    }
                }
            ]);
        } else {
            totalGames = await GameTimings.aggregate([
                {
                    $match: filter
                },
                {
                    $lookup: {
                        from: "games",
                        localField: "gameId",
                        foreignField: "_id",
                        as: "gameDetails"
                    }
                },
                {
                    $unwind: {
                        path: "$gameDetails",
                        preserveNullAndEmptyArrays: true
                    }
                },
                ...(activeStatus
                    ? [
                        {
                            $match: {
                                "gameDetails.activeStatus": Boolean(activeStatus)
                            }
                        }
                    ]
                    : []),
                {
                    $addFields: {
                        /// "lt" stands for "less than .",
                        "currentIST": new Date(Date.now() + (330 * 60000)).toISOString().split('T')[1].split('.')[0],
                        "currentUTC": new Date().toISOString(),
                        'cuOpenBidTime': { $substr: ["$openBidTime", 11, 8] },
                        'cuCloseBidTime': { $substr: ["$closeBidTime", 11, 8] },
                        isGameActive: { $and: [{ $lt: [new Date(Date.now() + (330 * 60000)).toISOString().split('T')[1].split('.')[0], { $substr: ["$closeBidTime", 11, 8] }] }, { gameDay: currentDayName }] },
                        isOpenBidActive: { $and: [{ $lt: [new Date(Date.now() + (330 * 60000)).toISOString().split('T')[1].split('.')[0], { $substr: ["$openBidTime", 11, 8] }] }, { gameDay: currentDayName }] },
                        isCloseBidActive: {
                            $and: [{ $lt: [new Date(Date.now() + (330 * 60000)).toISOString().split('T')[1].split('.')[0], { $substr: ["$closeBidTime", 11, 8] }] }, { gameDay: currentDayName }]
                        }
                    }
                },
                {
                    $lookup: {
                        from: "bidings",
                        let: { gameId: "$gameDetails._id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$gameId", "$$gameId"] },
                                            { $eq: ["$resultStatus", "PENDING"] },
                                            { $gte: ["$createdAt", new Date(`${todayDate}T00:00:00.000Z`)] },
                                            { $lte: ["$createdAt", new Date(`${todayDate}T23:59:59.999Z`)] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "bidings"
                    }
                },
                {
                    $project: {
                        gameId: 1,
                        gameDay: 1,
                        isOpen: 1,
                        gameCategory: 1,
                        openBidTime: 1,
                        closeBidTime: 1,
                        openBidResultTime: 1,
                        closeBidResultTime: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        gameIndex: "$gameDetails.gameIndex",
                        gameName: "$gameDetails.gameName",
                        gameCategory: "$gameDetails.gameCategory",
                        openNumber: "$gameDetails.openNumber",
                        closeNumber: "$gameDetails.closeNumber",
                        resultNumber: "$gameDetails.resultNumber",
                        guessingNumber: "$gameDetails.guessingNumber",
                        isGameActive: 1,
                        isOpenBidActive: 1,
                        isCloseBidActive: 1,
                        activeStatus: "$gameDetails.activeStatus",
                        holidayStatus: "$gameDetails.holidayStatus",
                        highlightStatus: "$gameDetails.highlightStatus",
                        resultDeclareDate: "$gameDetails.resultDeclareDate",
                        isWebShow: "$gameDetails.isWebShow",
                        isWebAnkShow: "$gameDetails.isWebAnkShow",
                        gameDayCount: "$gameDetails.gameDayCount",
                        gameExposure: {
                            $sum: "$bidings.gameAmount"
                        },
                        bidingsCount: { $size: "$bidings" }
                    }
                },
                {
                    $sort: {
                        gameIndex: 1
                    }
                }
            ]);
        }

        return res.status(200).json(new ApiResponse(200, totalGames));
    } catch (error) {
        console.error("Error fetching game:", error);
        throw new ApiError(500, "Error fetching game:" + error);
    }
});

/// Get Game By Id
export const getGameById = asyncHandler(async (req, res) => {
    const gameId = req.params.id;

    try {
        const totalGames = await Game.findById(gameId);

        return res.status(200).json(new ApiResponse(200, totalGames));
    } catch (error) {
        console.error("Error fetching game:", error);
        throw new ApiError(500, "Error fetching game:" + error);
    }
});

/// Create a new Game
export const createGame = asyncHandler(async (req, res) => {
    const {
        gameName,
        gameCategory,
        openNumber,
        closeNumber,
        resultNumber,
        openTime,
        closeTime,
        activeStatus,
        holidayStatus,
        highlightStatus,
        gameDayCount
    } = req.body;

    try {
        // Create a new game instance
        const newGame = new Game({
            gameName,
            gameCategory,
            openNumber,
            closeNumber,
            resultNumber,
            openTime,
            closeTime,
            activeStatus,
            holidayStatus,
            highlightStatus,
            gameDayCount
        });

        console.log(gameDayCount);

        // Save the game to the database
        const savedGame = await newGame.save();

        let isDay = true;

        for (const key in WeekDaysEnums) {
            const value = WeekDaysEnums[key];
            //console.log(key);
            if (gameDayCount == 5 && (key == "SATURDAY" || key == "SUNDAY")) {
                isDay = false;
            } else if (gameDayCount == 6 && key == "SUNDAY") {
                isDay = false;
            } else {
                isDay = true;
            }

            const openDateTime = new Date(openTime);
            const closeDateTime = new Date(closeTime);

            // Adding 5 minutes to openTime and closeTime
            openDateTime.setMinutes(openDateTime.getMinutes() + 5);
            closeDateTime.setMinutes(closeDateTime.getMinutes() + 5);

            if (isDay == true) {
                await GameTimings.create({
                    gameId: savedGame._id,
                    gameDay: value,
                    gameCategory,
                    isOpen: true,
                    openBidTime: openTime ? new Date(new Date(openTime).getTime() + (330 * 60000)).toISOString() : undefined,
                    closeBidTime: closeTime ? new Date(new Date(closeTime).getTime() + (330 * 60000)).toISOString() : undefined,
                    openBidResultTime: openDateTime ? new Date(new Date(openDateTime).getTime() + (330 * 60000)).toISOString() : undefined,
                    closeBidResultTime: closeDateTime
                        ? new Date(new Date(closeDateTime).getTime() + (330 * 60000)).toISOString()
                        : undefined
                });
            }
        }

        for (const key in GameTypeEnums) {
            const value = GameTypeEnums[key];

            if (gameCategory == "DAY GAME" || gameCategory == "QUICK MAHA LAXMI") {
                if (key == "SINGLE_DIGIT" || key == "PANA") {
                    console.log(key);
                } else {
                    await GameType.create({
                        gameId: savedGame._id,
                        gameType: value
                    });
                }
            }

            if (
                gameCategory == "QUICK DHAN LAXMI" &&
                (key == "SINGLE_DIGIT" ||
                    key == "PANA" ||
                    key == "SP_MOTOR" ||
                    key == "DP_MOTOR" ||
                    key == "SP_DP_TP" ||
                    key == "PANEL_GROUP" ||
                    key == "TWO_DIGIT_PANA" ||
                    key == "CHOICE_PANA")
            ) {
                await GameType.create({
                    gameId: savedGame._id,
                    gameType: value
                });
            }
        }
        for (const key in GameRatesEnums) {
            const value = GameRatesEnums[key];

            if (gameCategory == "QUICK DHAN LAXMI") {

                if (key == "HALF SANGAM" || key == "FULL SANGAM") {

                } else {
                    await GameRates.create({
                        gameId: savedGame._id,
                        gameType: key,
                        gamePrice: value
                    });
                }
            } else {
                await GameRates.create({
                    gameId: savedGame._id,
                    gameType: key,
                    gamePrice: value
                });
            }
        }

        return res.status(201).json(new ApiResponse(200, savedGame));
    } catch (error) {
        console.error("Error adding game:", error);
        throw new ApiError(500, "Error adding game:" + error);
    }
});

/// Update an existing game
export const updateGameById = asyncHandler(async (req, res) => {
    const gameId = req.params.id;

    try {
        const existingGame = await Game.findById(gameId);

        if (!existingGame) {
            // If the game with the given ID is not found, return an error
            throw new ApiError(404, "Game not found");
        }

        // Use the spread operator to update game properties
        existingGame.set({
            ...existingGame,
            ...req.body
        });
        // Save the updated game to the database
        const updatedGame = await existingGame.save();

        //console.log("Game updated successfully:", updatedGame);

        if ('isWebShow' in req.body || 'isWebAnkShow' in req.body) {
            await GameTimings.updateMany(
                {
                    gameId: gameId
                },
                {
                    $set: {
                        isWebShow: req.body.isWebShow,
                        isWebAnkShow: req.body.isWebAnkShow
                    }
                },
                { new: true }
            )
        }


        return res.status(200).json(new ApiResponse(200, updatedGame));
    } catch (error) {
        console.error("Error updating game:", error);
        throw new ApiError(500, "Error updating game:" + error);
    }
});

/// Delete Game By Id
export const deleteGameById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const deletedGame = await Game.findByIdAndDelete(id);

        await GameTimings.deleteMany({ gameId: id });

        await GameRates.deleteMany({ gameId: id });

        await GameType.deleteMany({ gameId: id });

        await GameResultModel.deleteMany({ gameId: id });

        return res.status(200).json(new ApiResponse(200, deletedGame));
    } catch (error) {
        console.error("Error while deleting game:", error);
        throw new ApiError(500, "Error while deleting game:" + error);
    }
});

/// Create a Game Type
export const createGameType = asyncHandler(async (req, res) => {
    const gameId = req.params.id;

    const { gameType } = req.body;

    try {
        const newGameType = new GameType({
            gameId,
            gameType
        });

        const savedGameType = await newGameType.save();

        console.log("GameType added successfully:", savedGameType);

        return res.status(201).json(new ApiResponse(200, savedGameType));
    } catch (error) {
        console.error("Error adding GameType:", error);
        throw new ApiError(500, "Error adding GameType:" + error);
    }
});

/// Get Total Game Types
export const getAllGameTypes = asyncHandler(async (req, res) => {
    const gameId = req.params.id;

    const currentDate = new Date();

    const currentDayName = WeekDaysEnums[currentDate.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()];

    let filter = {
        gameId: new mongoose.Types.ObjectId(gameId)
    };

    try {
        // const gameDetails = await Game.findById(gameId);

        const gameDetails = await GameTimings.aggregate([
            {
                $match: {
                    gameId: new mongoose.Types.ObjectId(gameId),
                    gameDay: currentDayName
                }
            },
            {
                $lookup: {
                    from: "games",
                    localField: "gameId",
                    foreignField: "_id",
                    as: "gameDetails"
                }
            },
            {
                $unwind: {
                    path: "$gameDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    gameId: 1,
                    gameDay: 1,
                    isOpen: 1,
                    gameCategory: 1,
                    openBidTime: 1,
                    closeBidTime: 1,
                    openBidResultTime: 1,
                    closeBidResultTime: 1
                }
            },
            {
                $sort: {
                    gameIndex: 1
                }
            }
        ]);

        // Convert date strings to Date objects
        const openBidTime = (new Date(gameDetails[0]["openBidTime"])).toISOString().split('T')[1].split('.')[0];
        const openBidResultTime = (new Date(gameDetails[0]["openBidResultTime"])).toISOString().split('T')[1].split('.')[0];
        const closeBidTime = (new Date(gameDetails[0]["closeBidTime"])).toISOString().split('T')[1].split('.')[0];
        const closeBidResultTime = (new Date(gameDetails[0]["closeBidResultTime"])).toISOString().split('T')[1].split('.')[0];
        const currentTime = new Date(Date.now() + (330 * 60000)).toISOString().split('T')[1].split('.')[0];

        // "currentIST": new Date(Date.now() + (330 * 60000)).toISOString().split('T')[1].split('.')[0],
        // "currentUTC": new Date().toISOString(),
        // 'cuOpenBidTime': { $substr: ["$openBidTime", 11, 8] },
        console.log("Current Time:", currentTime);
        console.log("openBidTime:", openBidTime);
        console.log("closeBidTime:", closeBidTime);
        console.log("openBidResultTime:", gameDetails[0]["openBidResultTime"]);

        // Compare Date objects directly
        console.log("Is Open Bid Time Passed?", currentTime > openBidTime);
        console.log("Is Close Bid Time Passed?", currentTime > closeBidTime);


        if (currentTime > openBidResultTime) {
            filter.gameType = {
                $in: [
                    "CLOSE",
                    "CLOSE PANA",
                    "SP MOTOR",
                    "DP MOTOR",
                    "SP DP TP",
                    "ODD EVEN",
                    "PANEL GROUP",
                    "TWO DIGIT PANA (CP,SR)",
                    "CHOICE PANA"
                ]
            };
        }

        if (currentTime > openBidTime && currentTime > closeBidTime) {
            return res.status(200).json(new ApiResponse(200, []));
        }

        //  const allGameTypes = await GameType.find(filter);
        const allGameTypes = await GameType.aggregate([
            {
                $match: filter
            },
            {
                $lookup: {
                    from: "games",
                    localField: "gameId",
                    foreignField: "_id",
                    as: "gameDetails"
                }
            },
            {
                $unwind: {
                    path: "$gameDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    isOpenBidActive: currentTime < openBidTime,
                    isCloseBidActive: currentTime < closeBidTime
                }
            }
        ]);

        return res.status(200).json(new ApiResponse(200, allGameTypes));
    } catch (error) {
        console.error("Error retrieving GameTypes:", error);
        throw new ApiError(500, "Error retrieving GameTypes:" + error);
    }
});

/// Get Game type by Id
export const getGameTypeById = asyncHandler(async (req, res) => {
    const gameTypeId = req.params.id;

    let filter = {
        //  _id: new mongoose.Types.ObjectId(gameTypeId)
    };
    try {
        const gameType = await GameType.findById(gameTypeId);

        // const gameType = await GameType.aggregate([
        //     {
        //         $match: filter
        //     },
        //     {
        //         $lookup: {
        //             from: 'games',
        //             localField: 'gameId',
        //             foreignField: '_id',
        //             as: 'gameDetails'
        //         }
        //     },
        //     {
        //         $unwind: {
        //             path: '$gameDetails',
        //             preserveNullAndEmptyArrays: true
        //         }
        //     }

        // ]);

        if (!gameType) {
            return res.status(404).json(new ApiResponse(404, "GameType not found"));
        }
        return res.status(200).json(new ApiResponse(200, gameType));
    } catch (error) {
        console.error("Error retrieving GameType:", error);
        throw new ApiError(500, "Error retrieving GameType:" + error);
    }
});

/// Update GameType  By Id
export const updateGameTypeById = asyncHandler(async (req, res) => {
    const gameTypeId = req.params.id;
    const { gameType, title } = req.body;

    try {
        const updatedGameType = await GameType.findByIdAndUpdate(gameTypeId, { gameType, title }, { new: true });

        if (!updatedGameType) {
            return res.status(404).json(new ApiResponse(404, "GameType not found"));
        }

        console.log("GameType updated successfully:", updatedGameType);
        return res.status(200).json(new ApiResponse(200, updatedGameType));
    } catch (error) {
        console.error("Error updating GameType:", error);
        throw new ApiError(500, "Error updating GameType:" + error);
    }
});

/// Delete GameType By Id
export const deleteGameTypeById = asyncHandler(async (req, res) => {
    const gameTypeId = req.params.id;

    try {
        const deletedGameType = await GameType.findByIdAndDelete(gameTypeId);

        if (!deletedGameType) {
            return res.status(404).json(new ApiResponse(404, "GameType not found"));
        }

        console.log("GameType deleted successfully:", deletedGameType);
        return res.status(200).json(new ApiResponse(200, deletedGameType));
    } catch (error) {
        console.error("Error deleting GameType:", error);
        throw new ApiError(500, "Error deleting GameType:" + error);
    }
});

/// Get Game Total Enums
export const getGameTotalEnums = asyncHandler(async (req, res) => {
    try {
        return res.status(200).json(
            new ApiResponse(200, {
                totalGameCategories: GameCategoryEnums,
                totalGameSubTypes: GameTypeEnums,
                totalTransactionTypes: TransactionTypeEnums,
                totalPaymentStatus: TransactionPaymentEnums,
                totalGameResultStatus: GameResultEnums,
                totalWeekDays: WeekDaysEnums
            })
        );
    } catch (error) {
        console.error("Error retrieving GameTypes:", error);
        throw new ApiError(500, "Error retrieving GameTypes:" + error);
    }
});

/// Update Game Timing  by GameID and Game Timing ID
export const updateGameTimingById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { updateType } = req.query;

    const { openBidTime, closeBidTime, openBidResultTime, closeBidResultTime, isOpen } = req.body;

    try {
        let updatedGameTiming;
        if (updateType == "multiple") {
            updatedGameTiming = await GameTimings.updateMany(
                {
                    gameId: id
                },
                {
                    $set: {
                        openBidTime: openBidTime ? new Date(new Date(openBidTime).getTime() + (330 * 60000)).toISOString() : undefined,
                        closeBidTime: closeBidTime
                            ? new Date(new Date(closeBidTime).getTime() + (330 * 60000)).toISOString()
                            : undefined,
                        openBidResultTime: openBidResultTime
                            ? new Date(new Date(openBidResultTime).getTime() + (330 * 60000)).toISOString()
                            : undefined,
                        closeBidResultTime: closeBidResultTime
                            ? new Date(new Date(closeBidResultTime).getTime() + (330 * 60000)).toISOString()
                            : undefined,
                        isOpen
                    }
                },
                { new: true }
            );
        } else {
            updatedGameTiming = await GameTimings.findByIdAndUpdate(
                id,
                {
                    openBidTime: openBidTime ? new Date(new Date(openBidTime).getTime() + (330 * 60000)).toISOString() : undefined,
                    closeBidTime: closeBidTime ? new Date(new Date(closeBidTime).getTime() + (330 * 60000)).toISOString() : undefined,
                    openBidResultTime: openBidResultTime
                        ? new Date(new Date(openBidResultTime).getTime() + (330 * 60000)).toISOString()
                        : undefined,
                    closeBidResultTime: closeBidResultTime
                        ? new Date(new Date(closeBidResultTime).getTime() + (330 * 60000)).toISOString()
                        : undefined,
                    isOpen
                },
                { new: true }
            );
        }

        if (!updatedGameTiming) {
            return res.status(404).json(new ApiResponse(404, "Game Timing not found"));
        }

        console.log("Game Timing updated successfully:", updatedGameTiming);
        return res.status(200).json(new ApiResponse(200, updatedGameTiming));
    } catch (error) {
        console.error("Error updating Game Timing:", error);
        throw new ApiError(500, "Error updating Game Timing:" + error);
    }
});

/// Get Game Rates By Id
export const getGameRatesById = asyncHandler(async (req, res) => {
    const gameId = req.params.id;

    let filter = { gameId: gameId };

    try {
        const totalGameRates = await GameRates.find(filter);

        return res.status(200).json(new ApiResponse(200, totalGameRates));
    } catch (error) {
        console.error("Error fetching game rates :", error);
        throw new ApiError(500, "Error fetching game retes :" + error);
    }
});
/// Get Game Rates By Id
export const getGameRateUniquely = asyncHandler(async (req, res) => {
    try {
        const totalGameRates = await GameRates.aggregate([
            {
                $lookup: {
                    from: "games",
                    localField: "gameId",
                    foreignField: "_id",
                    as: "gameDetails"
                }
            },
            {
                $unwind: "$gameDetails"
            },
            {
                $project: {
                    _id: 1,
                    gameId: 1,
                    gameType: 1,
                    gamePrice: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    gameName: "$gameDetails.gameName",
                    gameCategory: "$gameDetails.gameCategory"
                }
            },
            {
                $group: {
                    _id: null,
                    uniqueGamePrices: {
                        $addToSet: "$gamePrice"
                    },
                    uniqueGameTypes: {
                        $addToSet: "$gameType"
                    },
                    data: {
                        $push: "$$ROOT"
                    }
                }
            },
            {
                $unwind: "$uniqueGamePrices"
            },
            {
                $unwind: "$uniqueGameTypes"
            },
            {
                $project: {
                    uniqueGamePrice: "$uniqueGamePrices",
                    uniqueGameType: "$uniqueGameTypes",
                    data: 1
                }
            },
            {
                $unwind: "$data"
            },
            {
                $match: {
                    $expr: {
                        $and: [
                            {
                                $eq: ["$data.gamePrice", "$uniqueGamePrice"]
                            },
                            {
                                $eq: ["$data.gameType", "$uniqueGameType"]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $concat: [
                            {
                                $toString: "$uniqueGamePrice"
                            },
                            " - ",
                            "$uniqueGameType",
                            " - ",
                            "$data.gameCategory"
                        ]
                    },
                    gameNames: {
                        $push: "$data.gameName"
                    },
                    gameType: {
                        $addToSet: "$uniqueGameType"
                    },
                    gameCategory: {
                        $addToSet: "$data.gameCategory"
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    gameNames: 1,
                    gamePrice: {
                        $regexFind: {
                            input: "$_id",
                            regex: "[0-9.]+"
                        }
                    },
                    gameCategory: {
                        $first: "$gameCategory"
                    },
                    gameType: {
                        $first: "$gameType"
                    }
                }
            }
        ]);

        let quickDhanLaxmiList = [];
        let quickMahaLaxmiList = [];
        let normalBazarGameList = [];
        let normalBazarGameList1 = [];

        for (const e of totalGameRates) {
            if (e["gameCategory"].toString() === "QUICK DHAN LAXMI" && e["gameType"] != "JODI") {
                quickDhanLaxmiList.push({
                    title: "QUICK DHANLAXMI EVERY HOUR RATE",
                    gameType: `${e["gameType"]}`,
                    gamePrice: parseFloat(e["gamePrice"]["match"].toString())
                });
            }
            if (e["gameCategory"].toString() === "QUICK MAHA LAXMI") {
                quickMahaLaxmiList.push({
                    title: "QUICK MAHALAXMI ALL JACKPOT RATE",
                    gameType: `${e["gameType"]}`,
                    gamePrice: parseFloat(e["gamePrice"]["match"].toString())
                });
            }
            if (e["gameCategory"].toString() === "DAY GAME") {
                if (["10", "100", "160", "320", "1000", "1500", "15000"].includes(e["gamePrice"]["match"].toString())) {
                    normalBazarGameList.push({
                        title: e["gameNames"].toString(),
                        gameType: `${e["gameType"]}`,
                        gamePrice: parseFloat(e["gamePrice"]["match"].toString())
                    });
                }
                if (!["10", "100", "160", "320", "1000", "1500", "15000"].includes(e["gamePrice"]["match"].toString())
                    || ["FULL SANGAM"].includes(e["gameType"].toString())) {
                    normalBazarGameList1.push({
                        title: e["gameNames"].toString(),
                        gameType: `${e["gameType"]}`,
                        gamePrice: parseFloat(e["gamePrice"]["match"].toString())
                    });
                }
            }

        }

        return res.status(200).json(
            new ApiResponse(200,
                {
                    quickDhanLaxmiList: quickDhanLaxmiList.sort((a, b) => a.gamePrice - b.gamePrice),
                    quickMahaLaxmiList: quickMahaLaxmiList.sort((a, b) => a.gamePrice - b.gamePrice),
                    normalBazarGameList: normalBazarGameList.sort((a, b) => a.gamePrice - b.gamePrice),
                    normalBazarGameList1: normalBazarGameList1.sort((a, b) => a.gamePrice - b.gamePrice)
                }
            )
        );
    } catch (error) {
        console.error("Error fetching game rates :", error);
        throw new ApiError(500, "Error fetching game rates :" + error);
    }
});
/// Update Game Rates By Id
export const updateGameRatesById = asyncHandler(async (req, res) => {
    const gameId = req.params.id;

    const { rateId, gamePrice } = req.body;

    try {
        const filter = { _id: rateId, gameId: gameId };
        const update = { $set: { gamePrice: gamePrice } };
        const options = { new: true };

        const updatedGameRate = await GameRates.findOneAndUpdate(filter, update, options);

        if (!updatedGameRate) {
            // If the game rate is not found, return an error
            throw new ApiError(404, "Game rate not found");
        }

        return res.status(200).json(new ApiResponse(200, updatedGameRate));
    } catch (error) {
        console.error("Error fetching game rate:", error);
        throw new ApiError(500, "Error fetching game rate:" + error);
    }
});

/// Declare Game Result By Id
export const declareGameResultById = asyncHandler(async (req, res) => {
    const gameId = req.params.id;

    const { gameCategory, openResultNumber, closeResultNumber, resultDeclareDate } = req.body;

    const startOfDay = new Date(`${resultDeclareDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${resultDeclareDate}T23:59:59.999Z`);

    const currentTime = new Date().toTimeString().split(" ")[0];

    let finalResultDeclareDate = `${resultDeclareDate}T${currentTime}.000Z`;

    const resultDay = new Date(finalResultDeclareDate).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    console.log(finalResultDeclareDate);

    // console.log(req.body);
    //console.log(resultDay === today);

    let gameDetails = await Game.findById(gameId);

    const adminDetails = await Admin.findOne();

    console.log(`Game Details ${gameDetails}`);
    console.log(`Admin Details ${adminDetails}`);
    console.log(`Admin Details ${adminDetails.isGameNotificationOn}`);

    try {
        /// Condition for Open Number Result
        if (openResultNumber) {
            /// Get Current Game Result
            const result = await GameResultModel.findOne({
                gameId: gameId,
                gameCategory: gameCategory,
                resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
            });


            /// Add Open Number Result into GameResult
            if (result === null || (result !== null && result.openResultNumber === undefined)) {

                let gameResultNumber = getLastDigit(calculateDigitSum(openResultNumber)).toString();
                let newGameResult = {};

                // LOGIC (I)
                if (result !== null && result.openResultNumber === undefined) {
                    newGameResult = await GameResultModel.findOneAndUpdate(
                        {
                            gameId: gameId,
                            resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                        },
                        {
                            $set: {
                                openResultNumber,
                                gameResultNumber: getLastDigit(calculateDigitSum(openResultNumber)),
                            }
                        }, { new: true }
                    );
                } else {
                    newGameResult = new GameResultModel({
                        gameId,
                        gameCategory,
                        openResultNumber,
                        gameResultNumber: getLastDigit(calculateDigitSum(openResultNumber)),
                        resultDeclareDate: new Date(new Date(finalResultDeclareDate)).toISOString()
                    });
                }

                const savedGameResult = await newGameResult.save();

                // LOGIC (II)
                // Update isOpen In GameTiming By gameId
                const currentDayName =
                    WeekDaysEnums[new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()];
                await GameTimings.findOneAndUpdate(
                    {
                        gameId,
                        gameDay: currentDayName
                    },
                    {
                        $set: {
                            // isOpen: true
                        }
                    },
                    { new: true }
                );

                // LOGIC (III)
                // Update openNumber in Game By gameId

                let update = {
                    openNumber: openResultNumber,
                    resultNumber: gameResultNumber,
                    lastOpenNumber: openResultNumber,
                    lastResultNumber: gameResultNumber,
                    lastCloseNumber: null,
                    resultDeclareDate: new Date(new Date(finalResultDeclareDate)).toISOString()
                };

                if (gameCategory == "QUICK DHAN LAXMI") {
                    update.isGameActive = false;
                }

                let dGame = await Game.findById(gameId);

                if (resultDay === today) {
                    await Game.findOneAndUpdate(
                        {
                            _id: gameId
                        },
                        {
                            $set: update
                        },
                        { new: true }
                    );
                } else if (dGame.openNumber == null) {
                    await Game.findOneAndUpdate(
                        {
                            _id: gameId
                        },
                        {
                            $set: {
                                lastOpenNumber: openResultNumber,
                                lastResultNumber: gameResultNumber,
                                lastCloseNumber: null,
                                resultDeclareDate: new Date(new Date(finalResultDeclareDate)).toISOString()
                            }
                        },
                        { new: true }
                    );
                }

                // LOGIC (IV)
                /// Step 1 -> Get Biding Details
                let bidingDetailsList = await Biding.find({
                    gameId,
                    createdAt: { $gte: startOfDay, $lte: endOfDay }
                });
                // console.log(bidingDetailsList);

                for (const bidingDetails of bidingDetailsList) {
                    /// Step 2 -> Get Bid Result Number from Binding
                    let bidResultNumber;
                    let pendingCondition;
                    let isWinCondition;

                    if (bidingDetails.gameNumber.endsWith("X")) {
                        /// CONDITION FOR (OPEN)
                        bidResultNumber = bidingDetails.gameNumber.match(/\d+/)[0]; // WITHOUT X
                        ///  Win Condition
                        /// (bid-number == open-number) (123 = 123) or
                        /// (bid-number == digit-sum(open-number)) (1=1) and
                        /// (bid-number should be end with X ) 1X
                        isWinCondition = ((bidResultNumber == gameResultNumber) || (bidResultNumber == openResultNumber));

                        /// Pending Condition
                        pendingCondition = false;
                        console.log(`Hi Babu ${isWinCondition}`);
                        console.log(`${bidResultNumber} ${gameResultNumber} ${bidResultNumber == gameResultNumber}`);
                        console.log(`${bidResultNumber} ${openResultNumber} ${bidResultNumber == openResultNumber}`);
                    } else if (bidingDetails.gameNumber.startsWith("X")) {
                        /// CONDITION FOR (CLOSE)
                        bidResultNumber = bidingDetails.gameNumber.match(/\d+/)[0]; /// WITHOUT X
                        ///  Win Condition
                        isWinCondition = false;
                        /// Pending Condition
                        pendingCondition = true;
                    } else if (bidingDetails.gameNumber.charAt(1) == "X") {
                        /// CONDITION FOR Open Half Sangam ( OHS )
                        /// Bid :  1X123
                        /// Opne bid result number : 290
                        pendingCondition = bidingDetails.gameNumber.charAt(0) == gameResultNumber;
                        isWinCondition = false;
                    } else if (bidingDetails.gameNumber.charAt(3) == "X") {
                        /// CONDITION FOR Close Half Sangam ( CHS )
                        /// Bid : 123X2
                        /// Opne bid result number : 290
                        pendingCondition = bidingDetails.gameNumber.substring(0, 3) == openResultNumber;
                        isWinCondition = gameResultNumber == bidResultNumber;
                    } else {
                        bidResultNumber = bidingDetails.gameNumber;

                        pendingCondition =
                            bidResultNumber.trim().length == 2 && bidResultNumber.charAt(0) == gameResultNumber;

                        console.log(bidingDetails.gameNumber.charAt(1));

                        ///gameResultNumber == bidResultNumber ||
                        isWinCondition = openResultNumber == bidResultNumber;
                    }

                    console.log("OPEN-RESULT " + `${bidingDetails.gameNumber}`);
                    console.log("            " + `${openResultNumber}`);
                    console.log("            " + `${gameResultNumber}`);
                    console.log("            " + `${bidingDetails.gameNumber.charAt(1)}`);
                    console.log("            " + `${bidingDetails.gameNumber.charAt(3)}`);

                    /// Step 3 -> Get Game Bid Type from Biding

                    /// Step 4 -> Get Game Rate from GameRate
                    let gameRate = await GameRates.findOne({
                        gameId,
                        gameType: bidingDetails.gameRateType
                    });


                    /// Step 5 -> Update winAmount, resultStatus in Biding By gameId, gameType, gameNumber

                    await Biding.findOneAndUpdate(
                        {
                            _id: bidingDetails._id,
                            gameId: gameId,
                            gameType: bidingDetails.gameType,
                            gameNumber: bidingDetails.gameNumber,
                            createdAt: { $gte: startOfDay, $lte: endOfDay }
                        },
                        {
                            $set: {
                                winAmount: isWinCondition
                                    ? parseFloat(gameRate.gamePrice) * parseFloat(bidingDetails.gameAmount)
                                    : 0,
                                resultStatus: isWinCondition ? "WIN" : pendingCondition ? "PENDING" : "LOSS",
                                resultDeclareDate: new Date(new Date(finalResultDeclareDate)).toISOString(),
                                updatedBy: "OPEN"
                            }
                        },
                        { new: true }
                    );
                    // console.log("bidResultNumber :" + bidResultNumber + ` ${typeof bidResultNumber}`);
                    // console.log("gameResultNumber : " + gameResultNumber + ` ${typeof gameResultNumber}`);
                    // console.log("openResultNumber : " + openResultNumber + ` ${typeof openResultNumber}`);
                    // console.log(`${openResultNumber != bidResultNumber}`);

                    // console.log(gameResultNumber == bidResultNumber || openResultNumber == bidResultNumber);

                    if (isWinCondition) {
                        let userDetail = await User.findById(bidingDetails.userId);
                        /// MANAGE TRANSACTION
                        const transaction = await Transaction({
                            userId: bidingDetails.userId,
                            gameId: gameId,
                            previousAmount: userDetail.walletAmount,
                            transactionAmount: parseFloat(gameRate.gamePrice) * parseFloat(bidingDetails.gameAmount),
                            currentAmount:
                                parseFloat(userDetail.walletAmount) +
                                parseFloat(gameRate.gamePrice * bidingDetails.gameAmount),
                            transactionType: "CREDIT",
                            transactionStatus: "SUCCESS",
                            paymentFor: `bid`,
                            addedBy: "auto",
                            description: `${bidingDetails.gameName} Win ${bidingDetails.gameNumber}`,
                            gameName: bidingDetails.gameName,
                            gameType: bidingDetails.gameType,
                            playDate: bidingDetails.updatedAt,
                            gameSession: "OPEN",
                            resultDate: new Date(new Date(finalResultDeclareDate)).toISOString()
                        });

                        await User.findByIdAndUpdate(userDetail._id, {
                            walletAmount:
                                userDetail.walletAmount + (isWinCondition ? gameRate.gamePrice * bidingDetails.gameAmount : 0)
                        });
                        userDetail = await User.findById(bidingDetails.userId);
                        // Assign the generated _id to transactionId
                        transaction.transactionId = newGameResult._id; //transaction._id;
                        // Save the document again to update the transactionId field
                        await transaction.save();

                        if (gameDetails.gameCategory == "QUICK DHAN LAXMI" || gameDetails.gameCategory == "QUICK MAHA LAXMI") {
                            if (userDetail.isStarLineNotificationOn == true && adminDetails.isGameNotificationOn == true) {

                                sendNotifcationWithFirebase(userDetail.fcmToken, {
                                    title: `🎉🎉🎉 Congratulations 🎉🎉🎉`,
                                    body: `Hello ${userDetail.name} you have won Rs. ${parseFloat(gameRate.gamePrice) * parseFloat(bidingDetails.gameAmount)}  `
                                });
                            }
                        } else {
                            if (userDetail.fcmToken != undefined && userDetail.isMainNotificationOn != undefined
                                && userDetail.isStarLineNotificationOn == true && adminDetails.isGameNotificationOn == true) {
                                sendNotifcationWithFirebase(userDetail.fcmToken, {
                                    title: `🎉🎉🎉 Congratulations 🎉🎉🎉`,
                                    body: `Hello ${userDetail.name} you have won Rs. ${parseFloat(gameRate.gamePrice) * parseFloat(bidingDetails.gameAmount)}  `
                                });

                            }
                        }

                    }
                };

                let users = await User.find({}, { fcmToken: 1, isGameNotificationOn: 1, isMainNotificationOn: 1, isStarLineNotificationOn: 1, });


                users.forEach(userDetail => {
                    if (gameDetails.gameCategory == "QUICK DHAN LAXMI" || gameDetails.gameCategory == "QUICK MAHA LAXMI") {
                        if (userDetail.isStarLineNotificationOn == true && adminDetails.isGameNotificationOn == true) {

                            sendNotifcationWithFirebase(userDetail.fcmToken, {
                                title: `${gameDetails.gameName}`,
                                body: `${openResultNumber} - ${gameResultNumber}`
                            });
                        }
                    } else {
                        if (userDetail.fcmToken != undefined && userDetail.isMainNotificationOn != undefined
                            && userDetail.isMainNotificationOn == true && adminDetails.isGameNotificationOn == true) {

                            sendNotifcationWithFirebase(userDetail.fcmToken, {
                                title: `${gameDetails.gameName} `,
                                body: `${openResultNumber} - ${gameResultNumber}`
                            });
                        }
                    }
                });

                return res.status(201).json(new ApiResponse(200, savedGameResult));
            } else {
                console.error("Open Result is already declared");
                throw new ApiError(500, "Open Result is already declared");
            }
        }

        /// Condition for Close Number Result
        if (closeResultNumber) {
            const result = await GameResultModel.findOne({
                gameId: gameId,
                resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
            });

            // console.log(gameId);
            // console.log({ $gte: startOfDay, $lte: endOfDay });
            // console.log(result);


            const openResultSumDigit = getLastDigit(calculateDigitSum(result.openResultNumber)).toString();

            if (result != null && result.closeResultNumber === undefined) {
                let calculateJodiNumber = calculateGameFinalResult(
                    result.openResultNumber,
                    closeResultNumber
                ).toString();
                //console.log(calculateJodiNumber);

                if (result.gameResultNumber.toString() == "0" && calculateJodiNumber == "0") {
                    calculateJodiNumber = "00";
                } else if (result.gameResultNumber.toString() == "0" && calculateJodiNumber != "0") {
                    calculateJodiNumber = `0${calculateJodiNumber}`;
                }

                let gameResultNumber = getLastDigit(calculateDigitSum(closeResultNumber)).toString();
                const filter = { gameId: gameId, resultDeclareDate: { $gte: startOfDay, $lte: endOfDay } };
                const update = {
                    $set: {
                        closeResultNumber,
                        gameResultNumber: calculateJodiNumber
                    }
                };
                const options = { new: true };

                const updatedGameRate = await GameResultModel.findOneAndUpdate(filter, update, options);

                // Update isOpen In GameTiming By gameId
                const currentDayName =
                    WeekDaysEnums[new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()];
                await GameTimings.findOneAndUpdate(
                    {
                        gameId,
                        gameDay: currentDayName
                    },
                    {
                        $set: {
                            // isOpen: true
                        }
                    },
                    { new: true }
                );
                let dGame = await Game.findById(gameId);
                if (resultDay === today) {
                    // Update closeNumber in Game By gameId
                    await Game.findOneAndUpdate(
                        {
                            _id: gameId
                        },
                        {
                            $set: {
                                isGameActive: false,
                                closeNumber: closeResultNumber,
                                resultNumber: calculateJodiNumber,
                                lastResultNumber: calculateJodiNumber,
                                lastCloseNumber: closeResultNumber,
                            }
                        },
                        { new: true }
                    );
                } else if (dGame.closeNumber == null) {
                    await Game.findOneAndUpdate(
                        {
                            _id: gameId
                        },
                        {
                            $set: {
                                lastResultNumber: calculateJodiNumber,
                                lastCloseNumber: closeResultNumber,
                            }
                        },
                        { new: true }
                    );
                }

                // LOGIC (IV)
                /// Step 1 -> Get Biding Details
                let bidingDetailsList = await Biding.find({
                    gameId,
                    resultDeclareDate: { $gte: startOfDay, $lte: endOfDay },
                    resultStatus: "PENDING"
                });
                // console.log(bidingDetailsList);

                for (const bidingDetails of bidingDetailsList) {
                    /// Step 2 -> Get Bid Result Number from Binding
                    let bidResultNumber;
                    let isWinCondition;

                    if (bidingDetails.gameNumber.startsWith("X")) {
                        // CLOSE BID LOGIC
                        bidResultNumber = bidingDetails.gameNumber.match(/\d+/)[0];

                        isWinCondition = gameResultNumber == bidResultNumber || closeResultNumber == bidResultNumber;
                    } else if (bidingDetails.gameNumber.endsWith("X")) {
                        // OPEN BID LOGIC
                        bidResultNumber = bidingDetails.gameNumber.match(/\d+/)[0];

                        isWinCondition = gameResultNumber == bidResultNumber || closeResultNumber == bidResultNumber;
                    } else if (bidingDetails.gameNumber.charAt(3) == "X" && bidingDetails.gameNumber.length == 7) {
                        isWinCondition =
                            bidingDetails.gameNumber.substring(0, 3) == result.openResultNumber &&
                            bidingDetails.gameNumber.substring(4, 7) == closeResultNumber;

                    } else if (bidingDetails.gameNumber.charAt(1) == "X") {
                        /// CONDITION FOR Open Half Sangam ( O.H.S )
                        /// Bid Number : 1X123 1X600
                        /// Close Game Result Number = 345
                        isWinCondition =
                            bidingDetails.gameNumber.startsWith(openResultSumDigit) &&
                            bidingDetails.gameNumber.substring(2, 5) == closeResultNumber;

                        console.log(bidingDetails.gameNumber.substring(2, 5) == closeResultNumber);
                        console.log(`${bidingDetails.gameNumber.substring(2, 5)} :   ${closeResultNumber}`);

                    } else if (bidingDetails.gameNumber.charAt(3) == "X") {
                        /// CONDITION FOR Close Half Sangam ( C.H.S )
                        /// Bid Number: 123X2
                        /// Close Game Result Number = 345
                        isWinCondition =
                            bidingDetails.gameNumber.substring(0, 3) == result.openResultNumber &&
                            (bidingDetails.gameNumber.charAt(4) == gameResultNumber ||
                                bidingDetails.gameNumber.substring(4, 7) == closeResultNumber);
                    } else {
                        bidResultNumber = bidingDetails.gameNumber;

                        isWinCondition =
                            gameResultNumber == bidResultNumber ||
                            closeResultNumber == bidResultNumber ||
                            calculateJodiNumber == bidResultNumber;
                    }

                    console.log(`calculateJodiNumber ${calculateJodiNumber} bidResultNumber ${bidResultNumber}`);

                    // console.log("Jageshvar  " + `${bidingDetails.gameNumber}`);
                    // console.log("           " + `${result.openResultNumber}`);
                    // console.log("           " + `${bidResultNumber}`);
                    // console.log("           " + `${gameResultNumber}`);
                    // console.log("           " + `${bidingDetails.gameNumber.substring(0, 3)}`);
                    // console.log("           " + `${bidingDetails.gameNumber.charAt(4)}`);

                    /// Step 3 -> Get Game Bid Type from Biding
                    console.log(bidingDetails.gameRateType);
                    /// Step 4 -> Get Game Rate from GameRate
                    let gameRate = await GameRates.findOne({
                        gameId,
                        gameType: bidingDetails.gameRateType
                    });
                    // console.log(gameRate);

                    /// Step 5 -> Update winAmount, resultStatus in Biding By gameId, gameType, gameNumber

                    await Biding.find({
                        _id: bidingDetails._id,
                        gameId: gameId,
                        gameType: bidingDetails.gameType,
                        gameNumber: bidingDetails.gameNumber,
                        resultDeclareDate: { $gte: startOfDay, $lte: endOfDay },
                        resultStatus: "PENDING"
                    });

                    console.log("bidResultNumber :" + bidResultNumber + ` ${typeof bidResultNumber}`);
                    console.log("gameResultNumber : " + gameResultNumber + ` ${typeof gameResultNumber}`);
                    console.log("closeResultNumber : " + closeResultNumber + ` ${typeof closeResultNumber}`);
                    console.log("calculateJodiNumber : " + calculateJodiNumber + ` ${typeof calculateJodiNumber}`);
                    console.log(
                        gameResultNumber == bidResultNumber ||
                        closeResultNumber == bidResultNumber ||
                        calculateJodiNumber == bidResultNumber
                    );

                    console.log(gameRate);
                    await Biding.findOneAndUpdate(
                        {
                            _id: bidingDetails._id,
                            gameId: gameId,
                            gameType: bidingDetails.gameType,
                            gameNumber: bidingDetails.gameNumber,
                            resultDeclareDate: { $gte: startOfDay, $lte: endOfDay },
                            resultStatus: "PENDING"
                        },
                        {
                            $set: {
                                winAmount: isWinCondition ? gameRate.gamePrice * bidingDetails.gameAmount : 0,
                                resultStatus: isWinCondition ? "WIN" : "LOSS",
                                resultDeclareDate: new Date(new Date(finalResultDeclareDate).getTime()).toISOString(),
                                updatedBy: "CLOSE"
                            }
                        },
                        { new: true }
                    );

                    if (isWinCondition) {
                        let userDetail = await User.findById(bidingDetails.userId);
                        /// MANAGE TRANSACTION
                        const transaction = await Transaction({
                            userId: bidingDetails.userId,
                            gameId: gameId,
                            previousAmount: userDetail.walletAmount,
                            transactionAmount: parseFloat(gameRate.gamePrice) * parseFloat(bidingDetails.gameAmount),
                            currentAmount:
                                parseFloat(userDetail.walletAmount) +
                                parseFloat(gameRate.gamePrice * bidingDetails.gameAmount),
                            transactionType: "CREDIT",
                            transactionStatus: "SUCCESS",
                            paymentFor: "bid",
                            addedBy: "auto",
                            description: `${bidingDetails.gameName} Win ${bidingDetails.gameNumber}`,
                            gameName: bidingDetails.gameName,
                            gameType: bidingDetails.gameType,
                            playDate: bidingDetails.updatedAt,
                            gameSession: "CLOSE",
                            resultDate: new Date(new Date(finalResultDeclareDate).getTime()).toISOString()
                        });
                        // UPDATE USER WALLET
                        userDetail = await User.findById(bidingDetails.userId);

                        await User.findByIdAndUpdate(userDetail._id, {
                            walletAmount:
                                userDetail.walletAmount + (isWinCondition ? gameRate.gamePrice * bidingDetails.gameAmount : 0)
                        });
                        // Assign the generated _id to transactionId
                        transaction.transactionId = updatedGameRate._id; //transaction._id;
                        // Save the document again to update the transactionId field
                        await transaction.save();


                        if (gameDetails.gameCategory == "QUICK DHAN LAXMI" || gameDetails.gameCategory == "QUICK MAHA LAXMI") {
                            if (userDetail.isStarLineNotificationOn == true && adminDetails.isGameNotificationOn == true) {

                                sendNotifcationWithFirebase(userDetail.fcmToken, {
                                    title: `🎉🎉🎉 Congratulations 🎉🎉🎉`,
                                    body: `Hello ${userDetail.name} you have won Rs. ${parseFloat(gameRate.gamePrice) * parseFloat(bidingDetails.gameAmount)}  `
                                });
                            }
                        } else {
                            if (userDetail.fcmToken != undefined && userDetail.isMainNotificationOn != undefined
                                && userDetail.isGameNotificationOn == true && adminDetails.isGameNotificationOn == true) {
                                sendNotifcationWithFirebase(userDetail.fcmToken, {
                                    title: `🎉🎉🎉 Congratulations 🎉🎉🎉`,
                                    body: `Hello ${userDetail.name} you have won Rs. ${parseFloat(gameRate.gamePrice) * parseFloat(bidingDetails.gameAmount)}  `
                                });

                            }
                        }
                    }
                };

                if (!updatedGameRate) {
                    // If the game rate is not found, return an error
                    throw new ApiError(404, "Game Result not found");
                }



                let users = await User.find({}, { fcmToken: 1, isGameNotificationOn: 1, isMainNotificationOn: 1, isStarLineNotificationOn: 1, });


                users.forEach(userDetail => {
                    if (gameDetails.gameCategory == "QUICK DHAN LAXMI" || gameDetails.gameCategory == "QUICK MAHA LAXMI") {
                        if (userDetail.isStarLineNotificationOn == true && adminDetails.isGameNotificationOn == true) {

                            sendNotifcationWithFirebase(userDetail.fcmToken, {
                                title: `${gameDetails.gameName}`,
                                body: `${result.openResultNumber} - ${calculateJodiNumber} - ${closeResultNumber}`
                            });
                        }
                    } else {
                        if (userDetail.fcmToken != undefined && userDetail.isMainNotificationOn != undefined
                            && userDetail.isMainNotificationOn == true && adminDetails.isGameNotificationOn == true) {

                            sendNotifcationWithFirebase(userDetail.fcmToken, {
                                title: `${gameDetails.gameName}`,
                                body: `${result.openResultNumber} - ${calculateJodiNumber} - ${closeResultNumber}`
                            });
                        }
                    }
                });

                return res.status(200).json(new ApiResponse(200, updatedGameRate));
            } else if (result != null && result.closeResultNumber != undefined) {
                console.error("Close Result is already declared");
                throw new ApiError(500, "Close Result is already declared");
            } else {
                console.error("First declare Open result");
                throw new ApiError(500, "First declare Open result");
            }
        }
    } catch (error) {
        console.error("Error adding GameResult:", error);
        throw new ApiError(500, "Error adding GameResult:" + error);
    }
});

/// Update Game Result By Id
export const updateGameResultById = asyncHandler(async (req, res) => {
    const gameId = req.params.id;

    const { openResultNumber, closeResultNumber, gameResultNumber, resultDeclareDate } = req.body;

    const startOfDay = new Date(`${resultDeclareDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${resultDeclareDate}T23:59:59.999Z`);

    try {
        const filter = {
            gameId,
            resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
        };

        const update = {
            $set: {
                openResultNumber,
                closeResultNumber,
                gameResultNumber
            }
        };
        const options = { new: true };

        const updatedGameResult = await GameResultModel.findOneAndUpdate(filter, update, options);

        await Game.findOneAndUpdate(
            {
                _id: gameId,
                resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
            },
            {
                $set: {
                    openNumber: openResultNumber,
                    closeNumber: closeResultNumber,
                    resultNumber: gameResultNumber
                }
            },
            options
        );

        if (!updatedGameResult) {
            // If the game rate is not found, return an error
            throw new ApiError(404, "Game Result not found");
        }

        return res.status(200).json(new ApiResponse(200, updatedGameResult));
    } catch (error) {
        console.error("Error adding GameResult:", error);
        throw new ApiError(500, "Error adding GameResult:" + error);
    }
});

/// Get Game Result By Id
export const getGameResultById = asyncHandler(async (req, res) => {
    const gameId = req.params.id;

    const currentDate = new Date();
    const resultDeclareDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${currentDate.getDate().toString().padStart(2, "0")}`;

    const startOfDay = new Date(`${resultDeclareDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${resultDeclareDate}T23:59:59.999Z`);

    try {
        const filter = {
            gameId: gameId,
            // resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
        };

        const gameResults = await GameResultModel.find(filter).sort({ resultDeclareDate: -1 });

        if (!gameResults) {
            // If the game rate is not found, return an error
            throw new ApiError(404, "Game Result not found");
        }

        return res.status(200).json(new ApiResponse(200, gameResults));
    } catch (error) {
        console.error("Error adding GameResult:", error);
        throw new ApiError(500, "Error adding GameResult:" + error);
    }
});

/// Get Total Game Results
export const getTotalGameResult = asyncHandler(async (req, res) => {
    const { gameCategory, gameName, searchDate } = req.query;



    const currentDate = new Date();
    let resultDeclareDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${currentDate.getDate().toString().padStart(2, "0")}`;

    if (searchDate) {
        resultDeclareDate = searchDate;
    }

    const startOfDay = new Date(`${resultDeclareDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${resultDeclareDate}T23:59:59.999Z`);

    try {
        const filter = {
            ...(gameCategory ? { gameCategory: gameCategory } : {}),
            ...(req.url.includes("public") ? {} : { resultDeclareDate: { $gte: startOfDay, $lte: endOfDay } }),
        };

        if (gameName) {
            let gameDetails = await Game.findOne({ gameName: gameName });
            console.log(gameDetails._id);
            filter.gameId = gameDetails._id;
        }
        // const gameResults = await GameResultModel.find(filter);

        const gameResults = await GameResultModel.aggregate([
            {
                $match: filter
            },
            {
                $match: {
                    gameResultNumber: {
                        $exists: true,
                    },
                }
            },
            {
                $lookup: {
                    from: "games",
                    localField: "gameId",
                    foreignField: "_id",
                    as: "gameDetails"
                }
            },
            {
                $unwind: {
                    path: "$gameDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    gameId: 1,
                    gameDay: 1,
                    isOpen: 1,
                    gameCategory: 1,
                    openResultNumber: 1,
                    closeResultNumber: 1,
                    gameResultNumber: 1,
                    resultDeclareDate: 1,
                    guessingNumber: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    gameName: "$gameDetails.gameName"
                    // Include other fields you want to flatten
                    // gameDetails: '$gameDetails'
                }
            },
            {
                $sort: {
                    resultDeclareDate: -1
                }
            }
        ]);

        if (!req.url.includes("public")) {
            const concatenatedResults = await Promise.all(
                gameResults.map(async (element) => {
                    console.log(element);
                    const openNumberWinners = await Biding.aggregate([
                        {
                            $match: {
                                gameId: new mongoose.Types.ObjectId(element.gameId),
                                resultStatus: "WIN",
                                // gameNumber: { $regex: /X$/, $options: 'i' }, // Using regular expression to match the start with "X" case-insensitive
                                gameSession: "OPEN",
                                gameType: {
                                    $in: ["OPEN", "OPEN PANA", "ODD EVEN", "SINGLE DIGIT", "PANA",
                                        "SP MOTOR", "DP MOTOR", "TP MOTOR", "SP DP TP", "PANEL GROUP", "TWO DIGIT PANA (CP,SR)",
                                        "CHOICE PANA"]
                                },
                                resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                            }
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
                    const closeNumberWinners = await Biding.aggregate([
                        {
                            $match: {
                                gameId: new mongoose.Types.ObjectId(element.gameId),
                                resultStatus: "WIN",
                                //gameNumber: { $regex: /^X/, $options: 'i' }, // Using regular expression to match the end with "X" case-insensitive
                                // gameSession: "CLOSE",
                                $or: [
                                    {
                                        gameType: {
                                            $in: ["CHOICE PANA", "PANEL GROUP", "TWO DIGIT PANA (CP,SR)",
                                                "ODD EVEN", "SP DP TP", "SP MOTOR", "DP MOTOR", "TP MOTOR",]
                                        },
                                        gameSession: "CLOSE"
                                    },
                                    {
                                        gameType: {
                                            $in: ["CLOSE", "CLOSE PANA",
                                                "JODI", "JODI CYCLE", "RED HALF", "RED FULL", "FAMILY",
                                                "OPEN HALF SANGAM", "CLOSE HALF SANGAM", "FULL SANGAM"]
                                        }
                                    }
                                ],

                                resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                            }
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

                    let totalOpenData = await Biding.aggregate([
                        {
                            $match: {
                                gameId: new mongoose.Types.ObjectId(element.gameId),
                                resultStatus: "WIN",
                                // gameNumber: { $regex: /X$/, $options: 'i' }, // Using regular expression to match the start with "X" case-insensitive
                                gameSession: "OPEN",
                                gameType: {
                                    $in: ["OPEN", "OPEN PANA", "ODD EVEN", "SINGLE DIGIT", "PANA",
                                        "SP MOTOR", "DP MOTOR", "TP MOTOR", "SP DP TP", "PANEL GROUP", "TWO DIGIT PANA (CP,SR)",
                                        "CHOICE PANA"]
                                },
                                resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalWinAmout: {
                                    $sum: "$winAmount"
                                }

                            }
                        }

                    ]);
                    let totalCloseData = await Biding.aggregate([
                        {
                            $match: {
                                gameId: new mongoose.Types.ObjectId(element.gameId),
                                resultStatus: "WIN",
                                //gameNumber: { $regex: /^X/, $options: 'i' }, // Using regular expression to match the end with "X" case-insensitive
                                // gameSession: "CLOSE",
                                $or: [
                                    {
                                        gameType: {
                                            $in: ["CHOICE PANA", "PANEL GROUP", "TWO DIGIT PANA (CP,SR)",
                                                "ODD EVEN", "SP DP TP", "SP MOTOR", "DP MOTOR", "TP MOTOR",]
                                        },
                                        gameSession: "CLOSE"
                                    },
                                    {
                                        gameType: {
                                            $in: ["CLOSE", "CLOSE PANA",
                                                "JODI", "JODI CYCLE", "RED HALF", "RED FULL", "FAMILY",
                                                "OPEN HALF SANGAM", "CLOSE HALF SANGAM", "FULL SANGAM"]
                                        }
                                    }
                                ],

                                resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalWinAmout: {
                                    $sum: "$winAmount"
                                }

                            }
                        }

                    ]);


                    return {
                        gameResult: element,
                        openNumberWinners: openNumberWinners,
                        closeNumberWinners: closeNumberWinners,
                        totalOpenWinAmount: totalOpenData[0]?.["totalWinAmout"] ?? 0,
                        totalCloseWinAmount: totalCloseData[0]?.["totalWinAmout"] ?? 0
                    };
                })
            );


            // FOR PUBLIC RESPONSE 
            if (!gameResults) {
                // If the game rate is not found, return an error
                throw new ApiError(404, "Game Result not found");
            }

            return res.status(200).json(new ApiResponse(200, concatenatedResults));
        }

        let finalData = [];
        gameResults.forEach((e) => {

            finalData.push({ gameResult: e })
        })

        return res.status(200).json(new ApiResponse(200, finalData));

    } catch (error) {
        console.error("Error adding GameResult:", error);
        throw new ApiError(500, "Error adding GameResult:" + error);
    }
});

/// Delete Game Result
export const deleteGameResultById = asyncHandler(async (req, res) => {
    const gameId = req.params.id;

    const { resultDeclareDate, isOpenDelete, isCloseDelete } = req.query;

    const startOfDay = new Date(`${resultDeclareDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${resultDeclareDate}T23:59:59.999Z`);

    // const currentTime = new Date().toTimeString().split(' ')[0];

    let finalResultDeclareDate = `${resultDeclareDate}T00:00:00.000Z`;

    console.log(finalResultDeclareDate);

    // CASE I -> [ OPEN WRONG -> OPEN DELETE]

    // CASE II -> [ OPEN RIGHT -> NOT DELETE, CLOSE WRONG -> CLOSE DELETE]

    // CASE III -> [ OPEN WRONG, CLOSE RIGHT -> (FIRST DELETE -> CLOSE) Then -> (DELETE -> OPEN)]

    // CASE IV ->  [ OPEN WRONG, CLOSE WRONG -> (FIRST DELETE -> CLOSE) Then -> (DELETE -> OPEN)]

    try {

        let filter = {
            gameId: gameId,
            resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
        };
        /// Step 1 -> find Game Result 
        const gameResult = await GameResultModel.findOne(filter);

        let openResultNumber = gameResult.openResultNumber;

        /// if Game Result Exists 
        if (gameResult) {
            console.log(gameResult.openResultNumber);
            console.log(gameResult.closeResultNumber);

            if (isOpenDelete && (gameResult.closeResultNumber == undefined)) {

                ///  Step 1 -> delete Game Result
                const deletedResult = await GameResultModel.findOneAndDelete(filter);
                // console.log(deletedResult);


                ///  Step 2 -> Update Game 
                const updatedGame = await Game.findOneAndUpdate(
                    {
                        _id: gameId,
                        resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                    },
                    {
                        $set: {
                            openNumber: null,
                            closeNumber: null,
                            resultNumber: null
                        }
                    }, { new: true });

                console.log(updatedGame);

                ///  Step 3 -> Update All Bidings 
                const bidings = await Biding.updateMany(
                    {
                        gameId,
                        resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                    },
                    {
                        $set: {
                            winAmount: 0,
                            resultStatus: "PENDING",
                            resultDeclareDate: new Date(new Date(finalResultDeclareDate).getTime() + (330 * 60000)).toISOString()
                        }
                    },
                    { new: true }
                );

                /// Step 4 -> find total transactions related to this game  
                const transactions = await Transaction.find({
                    gameId: gameId,
                    transactionType: 'CREDIT',
                    resultDate: { $gte: startOfDay, $lte: endOfDay },
                    gameSession: "OPEN"
                });
                /// if Transactions Exists 
                if (transactions) {
                    for (const transaction of transactions) {
                        console.log("IN LOOP " + JSON.stringify(transaction));
                        console.log(transaction);

                        const user = await User.findById(transaction.userId);

                        let userDetail = await User.findByIdAndUpdate(
                            transaction.userId,
                            {
                                $set: {
                                    walletAmount: parseFloat(user.walletAmount) - parseFloat(transaction.transactionAmount)
                                }
                            },
                            { new: true }
                        );

                        const deletedDocument = await Transaction.findOneAndUpdate({
                            userId: transaction.userId,
                            gameId: gameId,
                            transactionType: 'CREDIT',
                            resultDate: { $gte: startOfDay, $lte: endOfDay },
                            gameSession: "OPEN"
                        }, {
                            $set: {
                                description: "Wrong Result ",
                                transactionType: 'REVERT',
                            }
                        },);


                        await Transaction.create({
                            transactionId: Date.now(),
                            userId: transaction.userId,
                            gameId: gameId,
                            transactionType: 'DEBIT',
                            transactionStatus: 'SUCCESS',
                            resultDate: new Date(new Date(finalResultDeclareDate).getTime() + (330 * 60000)).toISOString(),
                            gameSession: "OPEN",
                            description: `${deletedDocument.currentAmount} mistake result Amount Less `,
                            previousAmount: user.walletAmount,
                            transactionAmount: deletedDocument.transactionAmount,
                            currentAmount: userDetail.walletAmount,
                            paymentFor: 'bid',
                            addedBy: 'auto',
                        })

                        console.log(`deletedDocument : ${deletedDocument}`);


                        // if (deletedDocument) {
                        //     const nextDocuments = await Transaction.findOne({
                        //         _id: { $gt: deletedDocument._id, },
                        //         userId: transaction.userId
                        //     },
                        //     );

                        //     if (nextDocuments && nextDocuments.length > 0) {
                        //         // Next documents found
                        //         console.log(nextDocuments);
                        //         await Transaction.findOneAndUpdate({
                        //             _id: { $gt: deletedDocument._id, },
                        //             userId: transaction.userId
                        //         },
                        //             {
                        //                 $set: {
                        //                     previousAmount: userDetail.walletAmount,
                        //                     transactionAmount: parseFloat(nextDocuments.transactionAmount),
                        //                     currentAmount:
                        //                         parseFloat(userDetail.walletAmount) +
                        //                         parseFloat(nextDocuments.transactionAmount),
                        //                 }
                        //             }
                        //         );
                        //     } else {
                        //         // No next documents found
                        //         console.log('No next documents found');
                        //     }
                        // }
                    }
                }

                /// console.log(bidings);

                return res.status(200).json(new ApiResponse(200, deletedResult));

            } else if (isOpenDelete && (gameResult.closeResultNumber != undefined)) {
                throw new ApiError(500, "First delete close result number");
            } else if (isCloseDelete) {

                ///  Step 1 -> Update Game Result
                const updatedResult = await GameResultModel.findOneAndUpdate(
                    {
                        gameId: gameId,
                        resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                    },
                    {
                        $unset: { closeResultNumber: 1 }
                    },
                    { new: true });
                await GameResultModel.findOneAndUpdate(
                    {
                        gameId: gameId,
                        resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                    },
                    {
                        $set: {
                            gameResultNumber: updatedResult.gameResultNumber.substring(0, 1)
                        }
                    },
                    { new: true });
                // console.log(updatedResult);

                ///  Step 2 -> Update Game 
                const updatedGame = await Game.findOneAndUpdate(
                    {
                        _id: gameId,
                        resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                    },
                    {
                        $set: {
                            closeNumber: null,
                            resultNumber: updatedResult.gameResultNumber.substring(0, 1)
                        }
                    }, { new: true });

                // console.log(updatedGame);
                let gameResultNumber = getLastDigit(calculateDigitSum(gameResult.openResultNumber)).toString();

                let bidingDetailsList = await Biding.find({
                    gameId,
                    resultDeclareDate: { $gte: startOfDay, $lte: endOfDay },
                });
                // console.log(bidingDetailsList);

                for (const bidingDetails of bidingDetailsList) {
                    /// Step 2 -> Get Bid Result Number from Binding
                    let bidResultNumber;
                    let pendingCondition;
                    let isWinCondition;

                    if (bidingDetails.gameNumber.endsWith("X")) {
                        /// CONDITION FOR (OPEN)
                        bidResultNumber = bidingDetails.gameNumber.match(/\d+/)[0]; // WITHOUT X
                        ///  Win Condition
                        /// (bid-number == open-number) (123 = 123) or
                        /// (bid-number == digit-sum(open-number)) (1=1) and
                        /// (bid-number should be end with X ) 1X
                        isWinCondition = bidResultNumber == gameResultNumber || bidResultNumber == openResultNumber;
                        /// Pending Condition
                        pendingCondition = false;

                    } else if (bidingDetails.gameNumber.startsWith("X")) {
                        /// CONDITION FOR (CLOSE)
                        bidResultNumber = bidingDetails.gameNumber.match(/\d+/)[0]; /// WITHOUT X
                        ///  Win Condition
                        isWinCondition = false;
                        /// Pending Condition
                        pendingCondition = true;
                    } else if (bidingDetails.gameNumber.charAt(1) == "X") {
                        /// CONDITION FOR Open Half Sangam ( OHS )
                        /// Bid :  1X123
                        /// Opne bid result number : 290
                        pendingCondition = bidingDetails.gameNumber.charAt(0) == gameResultNumber;
                        isWinCondition = false;
                    } else if (bidingDetails.gameNumber.charAt(3) == "X") {
                        /// CONDITION FOR Close Half Sangam ( CHS )
                        /// Bid : 123X2
                        /// Opne bid result number : 290
                        pendingCondition = bidingDetails.gameNumber.substring(0, 3) == openResultNumber;
                        isWinCondition = gameResultNumber == bidResultNumber;
                    } else {
                        bidResultNumber = bidingDetails.gameNumber;

                        pendingCondition =
                            bidResultNumber.trim().length == 2 && bidResultNumber.charAt(0) == gameResultNumber;

                        console.log(bidingDetails.gameNumber.charAt(1));

                        ///gameResultNumber == bidResultNumber ||
                        isWinCondition = openResultNumber == bidResultNumber;
                    }


                    // Get the existing document
                    const existingDocument = await Biding.findOne({
                        _id: bidingDetails._id,
                        gameId: gameId,
                        gameType: bidingDetails.gameType,
                        gameNumber: bidingDetails.gameNumber,
                        resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                    });

                    // Calculate the new winAmount value based on the pendingCondition
                    let updatedWinAmountValue = pendingCondition ? 0 : existingDocument.winAmount;

                    // Update the document
                    await Biding.findOneAndUpdate(
                        {
                            _id: bidingDetails._id,
                            gameId: gameId,
                            gameType: bidingDetails.gameType,
                            gameNumber: bidingDetails.gameNumber,
                            resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                        },
                        {
                            $set: {
                                winAmount: updatedWinAmountValue,
                                resultStatus: isWinCondition ? "WIN" : pendingCondition ? "PENDING" : "LOSS",
                                resultDeclareDate: new Date(new Date(finalResultDeclareDate).getTime() + (330 * 60000)).toISOString()
                            }
                        },
                        { new: true }
                    );

                };


                ///  Step 3 -> Update All Bidings 
                // const bidings = await Biding.updateMany(
                //     {
                //         gameId,
                //         resultDeclareDate: { $gte: startOfDay, $lte: endOfDay },
                //         gameType: {
                //             $in: ["JODI", "JODI CYCLE", "CLOSE", "CLOSE PANA", "SP MOTOR", "DP MOTOR", "TP MOTOR", "SP DP TP",
                //                 "ODD EVEN", "PANEL GROUP", "TWO DIGIT PANA(CP,SR)", "CHOICE PANA"]
                //         },
                //         resultStatus: {
                //             $in: ["WIN","PENDING"]
                //         },

                //     },
                //     {
                //         $set: {
                //             winAmount: 0,
                //             resultStatus: "PENDING",
                //             resultDeclareDate: new Date(new Date(finalResultDeclareDate).getTime() + (330 * 60000)).toISOString()
                //         }
                //     },
                //     { new: true }
                // );

                /// console.log(bidings);

                /// Step 4 -> find total transactions related to this game  
                const transactions = await Transaction.find({
                    gameId: gameId,
                    transactionType: 'CREDIT',
                    resultDate: { $gte: startOfDay, $lte: endOfDay },
                    gameSession: "CLOSE"
                });
                /// if Transactions Exists 
                if (transactions) {
                    for (const transaction of transactions) {
                        console.log("IN LOOP " + JSON.stringify(transaction));
                        console.log(transaction);

                        const user = await User.findById(transaction.userId);

                        let userDetail = await User.findByIdAndUpdate(
                            transaction.userId,
                            {
                                $set: {
                                    walletAmount: parseFloat(user.walletAmount) - parseFloat(transaction.transactionAmount)
                                }
                            },
                            { new: true }
                        );


                        const deletedDocument = await Transaction.findOneAndUpdate({
                            userId: transaction.userId,
                            gameId: gameId,
                            transactionType: 'CREDIT',
                            resultDate: { $gte: startOfDay, $lte: endOfDay },
                            gameSession: "CLOSE"
                        }, {
                            $set: {
                                description: "Wrong Result",
                                transactionType: 'REVERT',
                            }
                        },);


                        await Transaction.create({
                            transactionId: Date.now(),
                            userId: transaction.userId,
                            gameId: gameId,
                            transactionType: 'DEBIT',
                            transactionStatus: 'SUCCESS',
                            resultDate: new Date(new Date(finalResultDeclareDate).getTime() + (330 * 60000)).toISOString(),
                            gameSession: "CLOSE",
                            description: `${deletedDocument.transactionAmount} mistake result Amount Less `,
                            previousAmount: user.walletAmount,
                            transactionAmount: deletedDocument.transactionAmount,
                            currentAmount: userDetail.walletAmount,
                            paymentFor: 'bid',
                            addedBy: 'auto',
                        })

                        console.log(`deletedDocument : ${deletedDocument}`);
                    }
                }


                return res.status(200).json(new ApiResponse(200, updatedResult));
            }

            else {
                throw new ApiError(500, "No result is selected for delete");
            }

        } else {
            throw new ApiError(500, "Game result not found ");
        }



    } catch (error) {
        console.error("Error : ", error);
        throw new ApiError(500, "" + error);
    }
});

export const getDayDifferenceOfLastResult = asyncHandler(async (req, res) => {

    const { gameSession, gameId } = req.query;


    try {

        let finalResult = await GameResultModel.aggregate([
            {

                $match: {
                    gameCategory: "DAY GAME",
                    gameId: new mongoose.Types.ObjectId(gameId)
                }
            },
            {
                $sort: {
                    resultDeclareDate: -1,
                },
            },
            ...(gameSession == "JODI") ? [{
                $addFields: {
                    gameNumberLength: 2//{ $strLenCP: "$gameResultNumber" }

                }
            },
            {
                $match: {
                    gameNumberLength: 2
                }
            }] : [],

            {
                $lookup: {
                    from: "games",
                    localField: "gameId",
                    foreignField: "_id",
                    as: "result",
                },
            },
            {
                $addFields: {
                    newField: {
                        $arrayElemAt: ["$result", 0],
                    },
                },
            },
            {
                $addFields: {
                    gameDayCount: "$newField.gameDayCount",
                },
            },
            {
                $sort: {
                    updatedAt: -1,
                },
            },
            {
                $group: {
                    _id: "$gameResultNumber",
                    lastDate: {
                        $first: "$updatedAt",
                    },
                    perWeekdayCount: {
                        $first: "$gameDayCount",
                    },
                },
            },
            {
                $match: {
                    _id: { $ne: null }
                }
            },
            {
                $project: {
                    gameNumber: "$_id",
                    perWeekdayCount: 1,
                    holidayInWeek: {
                        $subtract: [7, "$perWeekdayCount"],
                    },
                    lastDate: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$lastDate",
                        },
                    },
                    now: "$$NOW",
                    lastDate: {
                        $dateFromString: {
                            dateString: {
                                $dateToString: {
                                    format: "%Y-%m-%d",
                                    date: "$lastDate",
                                },
                            },
                        },
                    },
                    totalDayDifference: {
                        $round: {
                            $divide: [
                                {
                                    $subtract: [
                                        "$$NOW",
                                        {
                                            $dateFromString: {
                                                dateString: {
                                                    $dateToString: {
                                                        format: "%Y-%m-%d",
                                                        date: "$lastDate",
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                                1000 * 60 * 60 * 24,
                            ],
                        },
                    },
                },
            },
            {
                $addFields: {
                    lastDayOfWeek: { $dayOfWeek: "$lastDate" },
                    todayDayOfMonth: { $dayOfMonth: "$$NOW" },
                    lastWeekday: {
                        $let: {
                            vars: {
                                weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
                            },
                            in: {
                                $arrayElemAt: ["$$weekdays", { $subtract: [{ $dayOfWeek: "$lastDate" }, 1] }]
                            }
                        }
                    },
                    remainder: {
                        $mod: ["$totalDayDifference", 7],
                    },
                    quotient: {
                        $floor: {
                            $divide: ["$totalDayDifference", 7],
                        },
                    },
                },
            },
            {
                $addFields: {
                    dayDifference: {
                        $subtract: [
                            "$totalDayDifference",
                            {
                                $multiply: [

                                    {
                                        $switch: {
                                            branches: [

                                                {
                                                    case: { $eq: [{ $mod: ["$totalDayDifference", "$perWeekdayCount"], }, 0] },
                                                    then: {
                                                        $floor: {
                                                            $divide: ["$totalDayDifference", "$perWeekdayCount"],
                                                        },
                                                    }
                                                },
                                                { case: { $eq: ["$perWeekdayCount", "$lastDayOfWeek"] }, then: 1 },
                                            ],
                                            default: "$quotient"
                                        }
                                    },
                                    "$holidayInWeek",
                                ],
                            },
                        ],
                    },
                },
            },
            {
                $addFields: {
                    openDigit: {
                        $toInt: {
                            $substr: ["$gameNumber", 0, 1],
                        },
                    },
                    closeDigit: {
                        $cond: {
                            if: {
                                $eq: [
                                    {
                                        $strLenCP: "$gameNumber",
                                    },
                                    2,
                                ],
                            },
                            then: {
                                $toInt: {
                                    $substr: ["$gameNumber", 1, 1],
                                },
                            },
                            else: null,
                        },
                    },
                },
            },
            {
                $sort: {
                    lastDate: -1,
                },
            },
        ]);

        return res.status(200).json(new ApiResponse(200, finalResult));

    } catch (error) {
        console.error("Error while getting winners :", error);
        throw new ApiError(500, "Error while getting winners : " + error);
    }
});


export const addOrUpdateGuessingNumber = asyncHandler(async (req, res) => {
    try {
        const gameId = req.params.id;

        const { gameCategory, guessingNumber, resultDeclareDate } = req.body;

        const startOfDay = new Date(`${resultDeclareDate}T00:00:00.000Z`);
        const endOfDay = new Date(`${resultDeclareDate}T23:59:59.999Z`);

        const currentTime = new Date().toTimeString().split(" ")[0];

        let finalResultDeclareDate = `${resultDeclareDate}T${currentTime}.000Z`;

        const resultDay = new Date(finalResultDeclareDate).toISOString().split("T")[0];
        const today = new Date().toISOString().split("T")[0];


        const result = await GameResultModel.findOne({
            gameId: gameId,
            gameCategory: gameCategory,
            resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
        });

        console.log(resultDeclareDate);
        console.log(startOfDay);
        console.log(endOfDay);
        console.log(finalResultDeclareDate);
        console.log(result);

        let updatedData = {};

        if (result == null) {

            updatedData = await GameResultModel.create({
                gameId: gameId,
                gameCategory: gameCategory,
                guessingNumber: guessingNumber,
                resultDeclareDate: finalResultDeclareDate
            });
            if (resultDay === today) {
                await Game.findOneAndUpdate(
                    {
                        _id: gameId,
                    },
                    {
                        $set: {
                            guessingNumber: guessingNumber,
                        }
                    }, { new: true }
                );
            }



        } else {
            updatedData = await GameResultModel.findOneAndUpdate(
                {
                    gameId: gameId,
                    resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
                },
                {
                    $set: {
                        guessingNumber: guessingNumber,
                    }
                }, { new: true }
            );
            if (resultDay === today) {
                await Game.findOneAndUpdate(
                    {
                        _id: gameId,
                    },
                    {
                        $set: {
                            guessingNumber: guessingNumber,
                        }
                    }, { new: true }
                );
            }


        }



        return res.status(200).json(new ApiResponse(200, updatedData, "Guessing number updated successfully"));


    } catch (error) {
        console.error("Error adding guessing number :", error);
        throw new ApiError(500, "Error adding guessing number :" + error);
    }
});

export const getGuessingNumber = asyncHandler(async (req, res) => {
    try {
        const gameId = req.params.id;

        const { gameCategory, guessingNumber, resultDeclareDate } = req.body;

        const startOfDay = new Date(`${resultDeclareDate}T00:00:00.000Z`);
        const endOfDay = new Date(`${resultDeclareDate}T23:59:59.999Z`);

        const currentTime = new Date().toTimeString().split(" ")[0];

        let finalResultDeclareDate = `${resultDeclareDate}T${currentTime}.000Z`;

        const resultDay = new Date(finalResultDeclareDate).toISOString().split("T")[0];
        const today = new Date().toISOString().split("T")[0];


        const result = await GameResultModel.findOne({
            gameId: gameId,
            gameCategory: gameCategory,
            resultDeclareDate: { $gte: startOfDay, $lte: endOfDay }
        });



        return res.status(200).json(new ApiResponse(200, result));


    } catch (error) {
        console.error("Error : ", error);
        throw new ApiError(500, "Error : " + error);
    }
});