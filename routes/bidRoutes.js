import { Router } from "express";
import {
    createBid,
    getAllBids,
    getBidById,
    updateBidById,
    deleteBidById,
    getBidByUserId,
    getWinnerByGameId,
    getSalesReport,
    getRegularBazarReport,
    getQuickDhanLaxmiReport,
    getCuttingGroupReport,

} from "../controllers/bidController.js";
import { verifyJWT } from "../middlewares/token_validation.js";


const bidRoutes = Router();

// Apply verifyJWT middleware to all routes in the bidRoutes
// bidRoutes.use(verifyJWT); // Uncomment for all routes 

/// SALES
bidRoutes
    .route("/sales-report/")
    .get(verifyJWT, getSalesReport)

/// BIDS 
bidRoutes
    .route("/")
    .get(verifyJWT, getAllBids)
bidRoutes
    .route("/public")
    .get(getAllBids)

/// CREATE BID BY USER 
bidRoutes
    .route("/:id")
    .post(verifyJWT, createBid)
    .get(verifyJWT, getBidByUserId)

/// CRUD BIDS BY DETAILS  
bidRoutes
    .route("/details/:id")
    .get(verifyJWT, getBidById)
    .patch(verifyJWT, updateBidById)
    .delete(verifyJWT, deleteBidById)


/// WINNERS
bidRoutes
    .route("/winners/:gameId")
    .get(verifyJWT, getWinnerByGameId)

/// PROFIT/LOSS 
bidRoutes
    .route("/profit-loss-report/regular-bazar")
    .get(verifyJWT, getRegularBazarReport);

bidRoutes
    .route("/profit-loss-report/quick-dhan-laxmi")
    .get(verifyJWT, getRegularBazarReport);

bidRoutes
    .route("/profit-loss-report/quick-maha-laxmi")
    .get(verifyJWT, getRegularBazarReport);

bidRoutes
    .route("/profit-loss-report/cutting-group")
    .get(verifyJWT, getCuttingGroupReport);

export default bidRoutes;