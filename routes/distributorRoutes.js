import { Router } from "express";

import { verifyJWT } from "../middlewares/token_validation.js";
import {
    addParty,
    addPartyRates,
    deleteParty,
    deletePartyRates,
    depositChips,
    getGames,
    getParty,
    getPartyById,
    login,
    partyAccountAction,
    updateParty
} from "../controllers/distributorController.js";

const distributorRoutes = Router();

// Apply verifyJWT middleware to all routes in the distributorRoutes
// distributorRoutes.use(verifyJWT); // Uncomment for all routes

distributorRoutes.route("/login").post(login);

distributorRoutes.route("/games").get(verifyJWT, getGames);

distributorRoutes.route("/party").get(verifyJWT, getParty).post(verifyJWT, addParty);

distributorRoutes.route("/deposit").post(verifyJWT, depositChips);

distributorRoutes.route("/party-account-action").post(verifyJWT, partyAccountAction);

distributorRoutes
    .route("/party/:userId")
    .get(verifyJWT, getPartyById)
    .patch(verifyJWT, updateParty)
    .delete(verifyJWT, deleteParty);

distributorRoutes.route("/party-rates").post(verifyJWT, addPartyRates).delete(verifyJWT, deletePartyRates);

export default distributorRoutes;
