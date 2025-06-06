import { Router } from "express";
import { verifyJWT } from "../middlewares/token_validation.js";
import {
    addBonusAmount,
    addUpi,
    deleteUpiById,
    getCustomerBalance,
    getTotalTransactions,
    getTotalUpi,
    removeTransaction,
    updateTransactionStatus,
    updateUpi
} from "../controllers/transController.js";
import { upload } from "../middlewares/multer_file_uploader.js";

const transactionRoutes = Router();


transactionRoutes
    .route("/")
    .get(verifyJWT, getTotalTransactions)

transactionRoutes
    .route("/bonus/")
    .post(verifyJWT, addBonusAmount)

transactionRoutes
    .route("/remove")
    .post(verifyJWT, removeTransaction)

transactionRoutes
    .route("/customer-balance")
    .get(verifyJWT, getCustomerBalance)


transactionRoutes
    .route("/upi")
    .post(verifyJWT, upload.single("scanner"), addUpi)
    .get(verifyJWT, getTotalUpi)

transactionRoutes
    .route("/upi/:id")
    .patch(verifyJWT, upload.single("scanner"), updateUpi)
    .delete(verifyJWT, deleteUpiById)

export default transactionRoutes;