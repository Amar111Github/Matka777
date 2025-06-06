import { Router } from "express";
import {
    getTotalGames,
    createGame,
    updateGameById,
    deleteGameById,
    getGameById,
    createGameType,
    updateGameTypeById,
    deleteGameTypeById,
    getAllGameTypes,
    getGameTotalEnums,
    updateGameTimingById,
    getGameRatesById,
    updateGameRatesById,
    declareGameResultById,
    updateGameResultById,
    getGameResultById,
    getTotalGameResult,
    deleteGameResultById,
    getGameRateUniquely,
    getDayDifferenceOfLastResult,
    addOrUpdateGuessingNumber,
    getGuessingNumber,
    getGames,
} from "../controllers/gameController.js";
import { verifyJWT } from "../middlewares/token_validation.js";


const gameRoutes = Router();


/// GET CREATE GAME
gameRoutes
    .route("/")
    .get(verifyJWT, getTotalGames)
    .post(verifyJWT, createGame)

gameRoutes
    .route("/all")
    .get(getGames)

gameRoutes
    .route("/public")
    .get(getTotalGames)


/// CRUD GAME DETAILS
gameRoutes
    .route("/details/:id")
    .get(verifyJWT, getGameById)
    .patch(verifyJWT, updateGameById)
    .delete(verifyJWT, deleteGameById)

/// CRUD GAME TYPES 
gameRoutes
    .route("/gameTypes/:id")
    .get(verifyJWT, getAllGameTypes)
    .post(verifyJWT, createGameType)
    .patch(verifyJWT, updateGameTypeById)
    .delete(verifyJWT, deleteGameTypeById)

/// CRUD GAME TIMINGS
gameRoutes
    .route("/gameTimings/:id")
    .patch(verifyJWT, updateGameTimingById)

/// GAME RATES Uniquely
gameRoutes
    .route("/gameRates")
    .get(verifyJWT, getGameRateUniquely)

/// CRUD GAME RATES
gameRoutes
    .route("/gameRates/:id")
    .get(verifyJWT, getGameRatesById)
    .patch(verifyJWT, updateGameRatesById)



///  GAME RESULTS
gameRoutes
    .route("/gameResults/")
    .get(verifyJWT, getTotalGameResult)

/// GUESSING NUMBER     
gameRoutes
    .route("/guessing-numbers/:id")
    .get(verifyJWT, getGuessingNumber)
    .post(verifyJWT, addOrUpdateGuessingNumber)

gameRoutes
    .route("/public/gameResults/day-difference/")
    .get(getDayDifferenceOfLastResult)

gameRoutes
    .route("/public/gameResults/")
    .get(getTotalGameResult)

gameRoutes
    .route("/public/gameResults/:id")
    .get(getGameResultById)

/// CRUD GAME RESULTS
gameRoutes
    .route("/gameResults/:id")
    .get(verifyJWT, getGameResultById)
    .post(verifyJWT, declareGameResultById)
    .patch(verifyJWT, updateGameResultById)
    .delete(verifyJWT, deleteGameResultById)




/// GAME ENUMS 
gameRoutes
    .route("/gameEnums/")
    .get(verifyJWT, getGameTotalEnums)


export default gameRoutes;