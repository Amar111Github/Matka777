import { AppSetting, Notification, VideoModel, WebSetting, WithdrawSetting } from "../models/settingModel.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { WeekDaysEnums } from "../constants/constants.js";
import { Admin } from "../models/userModel.js";


// Add App Setting 

export const getAppSettings = asyncHandler(async (req, res) => {

    try {


        const savedSetting = await AppSetting.find();

        return res.status(201).json(new ApiResponse(200, savedSetting));


    } catch (error) {
        console.error('Error adding AppSetting:', error);
        throw new ApiError(500, 'Error adding AppSetting:' + error);
    }
});

// Get App Update
export const getAppUpdate = asyncHandler(async (req, res) => {
    const { appVersion } = req.query;
    try {

        const appSetting = await AppSetting.findOne();

        console.log(appSetting.appVersion);
        console.log(appVersion);

        

        if (appSetting.appVersion > appVersion) {
            return res.status(201).json(new ApiResponse(200, { updateAvailable: true }));
        } else {
            return res.status(201).json(new ApiResponse(200, { updateAvailable: false }));
        }

    } catch (error) {
        console.error('Error adding AppSetting:', error);
        throw new ApiError(500, 'Error adding AppSetting:' + error);
    }
});
// Add App Setting 
export const addAppSettings = asyncHandler(async (req, res) => {

    const requestBody = req.body;

    try {
        const newSetting = new AppSetting({ ...requestBody });

        const savedSetting = await newSetting.save();

        console.log('Setting added successfully:', savedSetting);

        return res.status(201).json(new ApiResponse(200, savedSetting));


    } catch (error) {
        console.error('Error adding AppSetting:', error);
        throw new ApiError(500, 'Error adding AppSetting:' + error);
    }
});

// Add or Update App Setting 
export const addOrUpdateAppSettings = asyncHandler(async (req, res) => {
    const requestBody = req.body;

    try {

        const existingSetting = await AppSetting.findOne();

        console.log(existingSetting);

        if (existingSetting) {

            // If an existing setting is found, update it with the new data
            Object.assign(existingSetting, requestBody);
            const updatedSetting = await existingSetting.save();

            console.log('Setting updated successfully:', updatedSetting);
            return res.status(200).json(new ApiResponse(200, updatedSetting));
        } else {

            // If no existing setting is found, create a new one
            const newSetting = new AppSetting(requestBody);
            const savedSetting = await newSetting.save();

            console.log('Setting added successfully:', savedSetting);
            return res.status(201).json(new ApiResponse(200, savedSetting));

        }
    } catch (error) {
        console.error('Error adding/updating AppSetting:', error);
        throw new ApiError(500, 'Error adding/updating AppSetting:' + error);
    }
});

/// Add Withdraw Setting 
export const addWithdrawSetting = asyncHandler(async (req, res) => {

    const requestBody = req.body;
    try {

        for (const key in WeekDaysEnums) {

            await new WithdrawSetting({
                withdrawDay: key,
                ...requestBody
            }).save();
        }

        return res.status(201).json(new ApiResponse(200));

    } catch (error) {
        console.error('Error adding AppSetting:', error);
        throw new ApiError(500, 'Error adding AppSetting:' + error);
    }

});

// Add or Update Withdraw Setting 
export const addOrUpdateWithdrawSetting = asyncHandler(async (req, res) => {
    const { withdrawStatus, openWithdrawTime, closeWithdrawTime } = req.body;
    try {
        for (const key in WeekDaysEnums) {
            const existingSetting = await WithdrawSetting.findOne({ withdrawDay: key });

            if (existingSetting) {
                // If an existing setting is found, update it with the new data
                Object.assign(existingSetting, {
                    withdrawStatus,
                    openWithdrawTime: new Date(new Date(openWithdrawTime).getTime() + (330 * 60000)).toISOString(),
                    closeWithdrawTime: new Date(new Date(closeWithdrawTime).getTime() + (330 * 60000)).toISOString()
                });

                // Ensure that existingSetting is an instance of the WithdrawSetting model
                if (!(existingSetting instanceof WithdrawSetting)) {
                    throw new Error('Retrieved document is not an instance of WithdrawSetting');
                }

                const updatedSetting = await existingSetting.save();
                console.log('WithdrawSetting updated successfully:', updatedSetting);
            } else {
                // If no existing setting is found, create a new one
                await new WithdrawSetting({
                    withdrawDay: key,
                    ...{
                        withdrawStatus,
                        openWithdrawTime: new Date(new Date(openWithdrawTime).getTime() + (330 * 60000)).toISOString(),
                        closeWithdrawTime: new Date(new Date(closeWithdrawTime).getTime() + (330 * 60000)).toISOString()
                    }
                }).save();
            }
        }

        return res.status(201).json(new ApiResponse(200));
    } catch (error) {
        console.error('Error adding/updating WithdrawSetting:', error);
        throw new ApiError(500, 'Error adding/updating WithdrawSetting:' + error);
    }
});

// Get Withdraw Setting by day or all settings
export const getWithdrawSetting = asyncHandler(async (req, res) => {


    const { withdrawDay } = req.query;

    let filter = {};

    if (withdrawDay) {
        filter.withdrawDay = withdrawDay;
    }

    try {

        const settings = await WithdrawSetting.find(filter);

        return res.status(200).json(new ApiResponse(200, settings));

    } catch (error) {

        console.error('Error getting WithdrawSetting:', error);
        throw new ApiError(500, 'Error getting WithdrawSetting:' + error);
    }
});

// Update Withdraw Setting by day or all settings
export const updateWithdrawSetting = asyncHandler(async (req, res) => {

    const { withdrawDay } = req.params;
    const { withdrawStatus, openWithdrawTime, closeWithdrawTime } = req.body;

    try {

        const updatedSetting = await WithdrawSetting.findOneAndUpdate(
            {
                withdrawDay: withdrawDay
            },
            {
                $set: {
                    withdrawStatus,
                    openWithdrawTime: new Date(new Date(openWithdrawTime).getTime() + (330 * 60000)).toISOString(),
                    closeWithdrawTime: new Date(new Date(closeWithdrawTime).getTime() + (330 * 60000)).toISOString()
                }
            },
            {
                new: true
            }
        );

        return res.status(200).json(new ApiResponse(200, updatedSetting));

    } catch (error) {

        console.error('Error getting WithdrawSetting:', error);
        throw new ApiError(500, 'Error getting WithdrawSetting:' + error);
    }
});

// Get WebSetting by day or all settings
export const getWebSetting = asyncHandler(async (req, res) => {

    let filter = {};

    try {

        const settings = await WebSetting.find(filter);

        return res.status(200).json(new ApiResponse(200, settings));

    } catch (error) {

        console.error('Error getting WebSetting:', error);
        throw new ApiError(500, 'Error getting WebSetting:' + error);
    }
});

// Add or Update Web Setting 
export const addOrUpdateWebSetting = asyncHandler(async (req, res) => {
    const requestBody = req.body;

    try {

        const existingSetting = await WebSetting.findOne({});

        if (existingSetting) {
            // If an existing setting is found, update it with the new data
            Object.assign(existingSetting, requestBody);

            // Ensure that existingSetting is an instance of the WebSetting model
            if (!(existingSetting instanceof WebSetting)) {
                throw new Error('Retrieved document is not an instance of WebSetting');
            }

            const updatedSetting = await existingSetting.save();
            console.log('WebSetting updated successfully:', updatedSetting);
        } else {
            // If no existing setting is found, create a new one
            await new WebSetting({ ...requestBody }).save();
        }


        return res.status(201).json(new ApiResponse(200));

    } catch (error) {
        console.error('Error adding/updating WebSetting:', error);
        throw new ApiError(500, 'Error adding/updating WebSetting:' + error);
    }
});

/// DELETE NOTIFICATION 
export const deleteNotifications = asyncHandler(async (req, res) => {

    const { id } = req.params;

    try {

        const newNotification = await Notification.findByIdAndDelete(id);

        return res.status(200).json(
            new ApiResponse(200, newNotification)
        );
    } catch (error) {
        console.log(error);
        throw new ApiError(500, error);
    }
});

// Toggle Withdrawal Request 
export const toggleNotification = asyncHandler(async (req, res) => {

    try {

        const admin = await Admin.findOne();

        const updatedAdmin = await Admin.findByIdAndUpdate(
            admin._id,
            {
                isNotificationOn: admin.isNotificationOn == true ? false : true
            },
            {
                new: true
            }
        )

        return res.status(200).json(new ApiResponse(200, updatedAdmin));

    } catch (error) {

        console.error("Something went wrong : " + error)
        throw new ApiError(500, error)
    }

});

// upload Video
export const videoUpload = asyncHandler(async (req, res) => {
    const { language, vTitle, vDescription, vUrl } = req.body;

    try {

        const newvideo = new VideoModel({
            language,
            vTitle,
            vDescription,
            vUrl
        });
        console.log(newvideo);

        const savedvideo = await newvideo.save();

        return res.status(201).json(
            new ApiResponse(201, savedvideo)
        );
    } catch (error) {
        console.log(error);
        throw new ApiError(500, error);
    }
});

// Get Videos
export const getVideos = asyncHandler(async (req, res) => {

    try {

        const savedvideo = await VideoModel.find();

        return res.status(200).json(new ApiResponse(200, savedvideo));

    } catch (error) {
        console.log(error);
        throw new ApiError(500, error);
    }
});

// Delete Video
export const deleteVideo = asyncHandler(async (req, res) => {

    const { videoId } = req.params;

    try {

        const savedvideo = await VideoModel.findByIdAndDelete(videoId);

        return res.status(200).json(new ApiResponse(200, savedvideo));

    } catch (error) {
        console.log(error);
        throw new ApiError(500, error);
    }
});