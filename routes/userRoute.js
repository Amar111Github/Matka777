import { Router } from "express";
import { verifyJWT } from "../middlewares/token_validation.js";
import { upload } from "../middlewares/multer_file_uploader.js";

import {
    addNotifications,
    addOrUpdateAdmin,
    adminLogin,
    adminRegister,
    changeMPin,
    getAdminDetails,
    getTotalNotifications,
    getTotalUsers,
    getUserById,
    changePassword,
    getUserDashboardData,
    loginUserWithMobileAndOTP,
    loginWithUserNameAndPass,
    mobileOtpGenerate,
    mpinLoginUser,
    registerUser,
    toggleWithdrawalRequest,
    updateUser,
    getAdminDashboardData,
    logOutUser,
    forgetMPin
} from "../controllers/userController.js";
import {
    addBonusAmount,
    addFundByUser,
    getTotalFundHistory,
    getTotalTransactions,
    updateTransactionStatus,
    updateUserWithdrawal,
    withdrawFundByUser
} from "../controllers/transController.js";


const userRoutes = Router();

/// Chanage Password
userRoutes
    .route("/change-password/:id")
    .post(verifyJWT, changePassword)

userRoutes
    .route("/forget-mpin/:id")
    .post(verifyJWT, forgetMPin)

userRoutes
    .route("/change-mpin/:id")
    .post(verifyJWT, changeMPin);


/// REGISTER
userRoutes
    .route("/register")
    .post(upload.single("avatar"), registerUser);

/// USER LOGIN 
userRoutes
    .route("/username-login")
    .post(loginWithUserNameAndPass);

userRoutes
    .route("/mobile-login")
    .post(loginUserWithMobileAndOTP);

/// USER LOGOUT 
userRoutes
    .route("/user-logout/:id")
    .post(verifyJWT, logOutUser);

/// GENERATE OTP 
userRoutes
    .route("/generate-otp/")
    .post(mobileOtpGenerate)

/// Verify OTP 
userRoutes
    .route("/verify-otp/")
    .post(mobileOtpGenerate)

/// M-PIN LOGIN    
userRoutes
    .route("/mpin-login/:id")
    .post(mpinLoginUser);

/// ADMIN LOGIN  
userRoutes
    .route("/admin-login")
    .post(adminLogin);

/// ADMIN REGISTER
userRoutes
    .route("/admin-register")
    .post(adminRegister);

userRoutes
    .route("/admin-details")
    .get(verifyJWT, getAdminDetails)
    .post(verifyJWT, upload.single("avatar"), addOrUpdateAdmin)

/// GET TOTAL USER
userRoutes
    .route("/")
    .get(verifyJWT, getTotalUsers);

/// USER FUNDS     
userRoutes
    .route("/fund/add/:id")
    .post(verifyJWT, addFundByUser);

userRoutes
    .route("/fund/withdraw/:id")
    .post(verifyJWT, withdrawFundByUser);

userRoutes
    .route("/fund/history/:id")
    .get(verifyJWT, getTotalFundHistory);

userRoutes
    .route("/fund/wallet/:id")
    .post(verifyJWT, updateUserWithdrawal);

/// USER DETAILS 
userRoutes
    .route("/details/:id")
    .get(verifyJWT, getUserById)
    .patch(verifyJWT, upload.single("avatar"), updateUser);



/// TRANSACTIONS 
userRoutes
    .route("/transactions/")
    .get(verifyJWT, getTotalTransactions);

userRoutes
    .route("/transactions/:id")
    .patch(verifyJWT, updateTransactionStatus);

/// TOGGLE WITHDRWAL 
userRoutes
    .route('/toggle-withdrwal')
    .patch(verifyJWT, toggleWithdrawalRequest);

/// USER DASHBOARD DATA 
userRoutes
    .route("/dashboard-data/:id")
    .get(verifyJWT, getUserDashboardData);

/// ADMIN DASHBOARD DATA 
userRoutes
    .route("/admin-dashboard-data")
    .get(verifyJWT, getAdminDashboardData)




export default userRoutes;