import { Router } from "express";
import { verifyJWT } from "../middlewares/token_validation.js";
import {
    addOrUpdateAppSettings,
    addOrUpdateWebSetting,
    addOrUpdateWithdrawSetting,
    deleteNotifications,
    deleteVideo,
    getAppSettings,
    getAppUpdate,
    getVideos,
    getWebSetting,
    getWithdrawSetting,
    toggleNotification,
    updateWithdrawSetting,
    videoUpload
} from "../controllers/settingController.js";
import { addNotifications, getTotalNotifications } from "../controllers/userController.js";
import { upload } from "../middlewares/multer_file_uploader.js";


const settingRoutes = Router();

/// APP SETTINGS
settingRoutes
    .route("/app/")
    .get(verifyJWT, getAppSettings)
    .post(verifyJWT, addOrUpdateAppSettings);

settingRoutes
    .route("/app-update/")
    .get(verifyJWT, getAppUpdate)

/// WEB SETTINGS
settingRoutes
    .route("/web/")
    .get(verifyJWT, getWebSetting)
    .post(verifyJWT, addOrUpdateWebSetting);


/// WITHDRAWAL SETTINGS
settingRoutes
    .route("/withdraw/")
    .get(verifyJWT, getWithdrawSetting)
    .post(verifyJWT, addOrUpdateWithdrawSetting);

settingRoutes
    .route("/withdraw/:withdrawDay")
    .patch(verifyJWT, updateWithdrawSetting);

/// NOTIFICATIONS 
settingRoutes
    .route("/notifications/")
    .get(verifyJWT, getTotalNotifications)
    .post(verifyJWT, upload.single("sourceUrl"), addNotifications);

settingRoutes
    .route("/notifications/:id")
    .delete(verifyJWT, deleteNotifications);


settingRoutes
    .route("/notifications-toggle/")
    .patch(verifyJWT, toggleNotification);

///upload video
settingRoutes
    .route("/uploadVideo/")
    .get(verifyJWT, getVideos)
    .post(verifyJWT, videoUpload);

settingRoutes
    .route("/uploadVideo/:videoId")
    .delete(verifyJWT, deleteVideo);



export default settingRoutes;