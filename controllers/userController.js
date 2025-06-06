import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Admin, OtpModel, User } from "../models/userModel.js";
import { Notification } from "../models/settingModel.js";
import jwt from "jsonwebtoken";
import { generateOTP } from "../utils/gameLogicUtils.js";
import { HistoryData, Transaction } from "../models/transModel.js";
import { Biding } from "../models/bidModel.js";
import { sendNotifcationWithFirebase } from "../utils/notifications.js";

/// Get Totol Users
export const getTotalUsers = asyncHandler(async (req, res) => {
    const { isBlocked, limit = 1000, page = 1 } = req.query;

    const skip = (page - 1) * limit;

    let filter = {};

    if (isBlocked) {
        filter.isBlocked = JSON.parse(isBlocked);
    }

    let date = new Date().toJSON();
    let todayDate = date.split("T")[0];

    console.log(filter);
    console.log(todayDate);

    // const existedUsers = await User.find(filter).sort({ createdAt: -1 });
    // const existedUsers = await Biding.find({userId:"6607b1a5e54454b531e048d4"}).sort({ createdAt: -1 });

    const existedUsers = await User.aggregate([
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
                from: "bidings",
                let: { userId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$userId", "$$userId"] },
                                    { $in: ["$resultStatus", ["PENDING", "WIN", "LOSS"]] }
                                ]
                            }
                        }
                    }
                ],
                as: "bidings"
            }
        },
        {
            $addFields: {
                allAmount: {
                    $let: {
                        vars: {
                            winAmount: {
                                $sum: {
                                    $map: {
                                        input: "$bidings",
                                        as: "bid",
                                        in: {
                                            $cond: {
                                                if: { $eq: ["$$bid.resultStatus", "WIN"] },
                                                then: "$$bid.winAmount",
                                                else: 0
                                            }
                                        }
                                    }
                                }
                            },
                            gameAmount: {
                                $sum: {
                                    $map: {
                                        input: "$bidings",
                                        as: "bid",
                                        in: {
                                            $cond: {
                                                if: { $in: ["$$bid.resultStatus", ["WIN", "LOSS"]] },
                                                then: "$$bid.gameAmount",
                                                else: 0
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        in: {
                            winAmount: "$$winAmount",
                            gameAmount: "$$gameAmount"
                        }
                    }
                }
            }
        },
        {
            $project: {
                _id: 1,
                uid: 1,
                name: 1,
                username: 1,
                mobile: 1,
                password: 1,
                mpin: 1,
                deviceName: 1,
                gameExposure: 1,
                isBlocked: 1,
                walletAmount: 1,
                createdAt: 1,
                updatedAt: 1,
                accountHolderName: 1,
                accountNumber: 1,
                bankName: 1,
                branchName: 1,
                ifscCode: 1,
                gPayNumber: 1,
                paytmNumber: 1,
                phonepeNumber: 1,
                upiId: 1,
                phonePeNumber: 1,
                referralCode: 1,
                gamerates: "$gamerates",
                gameExposure: {
                    $sum: {
                        $map: {
                            input: "$bidings",
                            as: "bid",
                            in: {
                                $cond: {
                                    if: {
                                        $and: [
                                            { $eq: ["$$bid.resultStatus", "PENDING"] },
                                            { $gte: ["$$bid.createdAt", new Date(`${todayDate}T00:00:00.000Z`)] },
                                            { $lte: ["$$bid.createdAt", new Date(`${todayDate}T23:59:59.999Z`)] }
                                        ]
                                    },
                                    then: "$$bid.gameAmount",
                                    else: 0
                                }
                            }
                        }
                    }
                },
                winAmount: "$allAmount.winAmount",
                gameAmount: "$allAmount.gameAmount",
                profitLoss: {
                    $concat: [
                        {
                            $cond: {
                                if: { $lt: ["$allAmount.winAmount", "$allAmount.gameAmount"] },
                                then: "+",
                                else: "-"
                            }
                        },
                        { $toString: { $abs: { $subtract: ["$allAmount.winAmount", "$allAmount.gameAmount"] } } },
                        ""
                    ]
                },
                bidingsCount: { $size: "$bidings" }
            }
        },
        {
            $sort: {
                walletAmount: -1
            }
        }
    ]);

    return res.status(200).json(new ApiResponse(200, existedUsers));
});

/// Get User Details
export const getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existedUsers = await User.findById(id);

    return res.status(200).json(new ApiResponse(200, existedUsers));
});

/// Get Admin Details
export const getAdminDetails = asyncHandler(async (req, res) => {
    const existedUsers = await Admin.find();

    return res.status(200).json(new ApiResponse(200, existedUsers));
});

/// change password
export const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const existedUsers = await Admin.find();
    // console.log(existedUsers[0].password);

    const updatedDetails = await Admin.findByIdAndUpdate(
        existedUsers[0]._id,
        {
            $set: {
                password: newPassword
            }
        },
        { new: true }
    );
    return res.status(200).json(new ApiResponse(200, updatedDetails));
});

/// forget mPin
export const forgetMPin = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { oldMPin, newMPin } = req.body;

    const user = await User.findById(id);

    try {
        if (user && oldMPin == newMPin) {
            const updatedDetails = await User.findByIdAndUpdate(
                user._id,
                {
                    $set: {
                        mpin: newMPin
                    }
                },
                { new: true }
            );

            return res.status(200).json(new ApiResponse(200, updatedDetails));
        } else {
            return res.status(200).json(new ApiResponse(200, {}, "Invalid Credentials"));
        }
    } catch (error) {
        console.error(error);
        throw new ApiError(500, error);
    }
});

/// Register a New User
export const registerUser = asyncHandler(async (req, res) => {
    const { name, username, mobile, password, mpin, deviceName, referralCode } = req.body;

    const existedUser = await User.findOne({ $or: [{ username }, { mobile }] });

    if (existedUser) {
        throw new ApiError(409, "User with mobile or username already exists", []);
    }
    var otp = Math.floor(1000 + Math.random() * 9000);

    if (referralCode) {
        const referredUser = await User.findOne({ uid: referralCode }, { uid: 1 });

        if (!referredUser) {
            throw new ApiError(404, "Invalid referral code", []);
        }
    }

    let uid;

    const lastUser = await User.findOne().sort({ uid: -1 });
    if (lastUser && lastUser.uid) {
        const lastNumber = parseInt(lastUser.uid.substring(1));
        uid = "C" + (lastNumber + 1).toString().padStart(6, "0");
    } else {
        uid = "C100001";
    }

    const createdUser = await User.create({
        uid,
        name,
        username,
        mobile,
        password,
        mpin,
        deviceName,
        otp: otp,
        otpExpiry: Date.now() + 300000,
        referralCode: referralCode || "",
        walletAmount: referralCode ? 20 : 0
    });

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    return res
        .status(201)
        .json(
            new ApiResponse(
                200,
                { user: createdUser },
                "Users registered successfully and verification email has been sent on your email."
            )
        );
});

/// Update User
export const updateUser = asyncHandler(async (req, res) => {
    const userId = req.params.id;

    try {
        // Find the user by ID
        const existingUser = await User.findById(userId);

        if (!existingUser) {
            // If the user with the given ID is not found, return an error
            throw new ApiError(404, "User not found");
        }

        // Create an object to hold the fields that need to be updated
        const updateFields = {
            // set the newly uploaded avatar
            avatar: req.file?.path || existingUser.avatar,
            name: req.body.name || existingUser.name,
            deviceName: req.body.deviceName || existingUser.deviceName,
            isBlocked: req.body.isBlocked || existingUser.isBlocked,
            walletAmount: req.body.walletAmount || existingUser.walletAmount,
            accountHolderName: req.body.accountHolderName || existingUser.accountHolderName,
            accountNumber: req.body.accountNumber || existingUser.accountNumber,
            bankName: req.body.bankName || existingUser.bankName,
            branchName: req.body.branchName || existingUser.branchName,
            ifscCode: req.body.ifscCode || existingUser.ifscCode,
            phonePeNumber: req.body.phonePeNumber || existingUser.phonePeNumber,
            paytmNumber: req.body.paytmNumber || existingUser.paytmNumber,
            gPayNumber: req.body.gPayNumber || existingUser.gPayNumber,
            upiId: req.body.upiId || existingUser.upiId,
            fcmToken: req.body.fcmToken || existingUser.fcmToken,
            isMainNotificationOn: req.body.isMainNotificationOn || existingUser.isMainNotificationOn,
            isGameNotificationOn: req.body.isGameNotificationOn || existingUser.isGameNotificationOn,
            isStarLineNotificationOn: req.body.isStarLineNotificationOn || existingUser.isStarLineNotificationOn
        };

        // Update the user with the fields in updateFields
        const updatedUser = await User.findByIdAndUpdate(existingUser._id, { $set: updateFields }, { new: true });

        console.log("User updated successfully:", updatedUser);

        return res.status(200).json(new ApiResponse(200, updatedUser, "User updated successfully"));
    } catch (error) {
        console.error("Error updating user:", error);
        throw new ApiError(500, "Error updating user: " + error);
    }
});

export const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // attach refresh token to the user document to avoid refreshing the access token with multiple refresh tokens
        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating the access token");
    }
};

/// Login User
export const loginWithUserNameAndPass = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username && !password) {
        throw new ApiError(400, "Username or password is required");
    }

    const user = await User.findOne({ username });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    // // Compare the incoming password with hashed password
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    return res.status(200).json(
        new ApiResponse(
            200,
            { user, accessToken, refreshToken }, // send access and refresh token in response if client decides to save them by themselves
            "User logged in successfully"
        )
    );
});

/// Logout User
export const logOutUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    await User.findByIdAndUpdate(
        user._id,
        {
            $unset: { token: 1 }
        },
        {
            new: true
        }
    );

    return res.status(200).json(new ApiResponse(200, {}, "User logged out successfully"));
});

// Login User with Mobile and OTP
export const loginUserWithMobileAndOTP = asyncHandler(async (req, res) => {
    const { mobile, otp, fcmToken } = req.body;

    if (!mobile || !otp) {
        throw new ApiError(400, "Mobile number and OTP are required");
    }

    // Verify the OTP
    const otpDetails = await OtpModel.findOne({ mobile, otp });

    if (!otpDetails) {
        throw new ApiError(400, "Invalid OTP");
    }

    if (otpDetails) {
        const user = await User.findOne({ mobile });
        if (!user) {
            throw new ApiError(400, "User not registered");
        }
        if (user.isBlocked) {
            throw new ApiError(400, "User is blocked");
        } else {
            // Generate access and refresh tokens
            const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

            await User.findByIdAndUpdate(
                user._id,
                {
                    $set: {
                        token: {
                            token: accessToken,
                            signedAt: Date.now()
                        },
                        fcmToken
                    }
                },
                {
                    new: true
                }
            );

            return res
                .status(200)
                .json(new ApiResponse(200, { user, accessToken, refreshToken }, "User logged in successfully"));
        }
    }
});

/// Login with MPIN
export const mpinLoginUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { mpin, fcmToken } = req.body;

    if (!mpin) {
        throw new ApiError(400, "MPIN is required");
    }

    let user = await User.findOne({ _id: id });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    if (mpin != user.mpin) {
        throw new ApiError(401, "Invalid user credentials");
    }

    if (user.isBlocked) {
        throw new ApiError(401, "You are blocked ");
    }

    user = await User.findByIdAndUpdate(id, { fcmToken }, { new: true, select: "name mobile fcmToken" });

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    return res.status(200).json(
        new ApiResponse(
            200,
            { user, accessToken, refreshToken }, // send access and refresh token in response if client decides to save them by themselves
            "User logged in successfully"
        )
    );
});

/// Mobile  OTP Generate
export const mobileOtpGenerate = asyncHandler(async (req, res) => {
    const { mobile } = req.body;

    try {
        const otpDetails = await OtpModel.findOne({ mobile });

        const otpCode = generateOTP();

        if (!otpDetails) {
            let newOtpDetails = await OtpModel.create({
                mobile: mobile,
                otp: otpCode,
                otpExpiry: Date.now() + 300000
            });

            return res.status(200).json(new ApiResponse(200, newOtpDetails, "Otp generated sucessfully"));
        }

        let updatedOtpDetails = await OtpModel.findOneAndUpdate(
            {
                mobile
            },
            {
                $set: {
                    otp: otpCode,
                    otpExpiry: Date.now() + 300000
                }
            },
            { new: true }
        );

        return res.status(200).json(new ApiResponse(200, updatedOtpDetails, "Otp generated sucessfully"));
    } catch (error) {
        console.error("Error while generating otp :", error);
        throw new ApiError(500, "Error while generating otp : " + error);
    }
});

/// Change MPIN
export const changeMPin = asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const { otpCode, oldMPin, newMPin } = req.body;

    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, "User does not exist");
        }
        // Verify the OTP
        const otpDetails = await OtpModel.findOne({ mobile: user.mobile, otp: otpCode });

        if (!otpDetails) {
            throw new ApiError(400, "Invalid OTP");
        }

        if (oldMPin != user.mpin) {
            throw new ApiError(400, "Invalid Credentials");
        }

        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            {
                $set: {
                    mpin: newMPin
                }
            },
            { new: true }
        );

        // console.log("User updated successfully:", updatedUser);

        return res.status(200).json(new ApiResponse(200, updatedUser, "mPin updated successfully"));
    } catch (error) {
        console.error(error);
        throw new ApiError(500, "" + error);
    }
});

/// Admin Login
export const adminLogin = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username && !password) {
        throw new ApiError(400, "username & password  is required");
    }

    const user = await Admin.findOne({ username, password });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    // Compare the incoming password with hashed password
    //const isPasswordValid = await user.isPasswordCorrect(password);

    // if (!isPasswordValid) {
    //   throw new ApiError(401, "Invalid user credentials");
    // }

    // const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    //   user._id
    // );
    const token = await jwt.sign(
        {
            _id: user._id,
            username: user._id
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            { user, accessToken: token, refreshToken: token }, // send access and refresh token in response if client decides to save them by themselves
            "User logged in successfully"
        )
    );
});

/// Admin Login
export const adminRegister = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username && !password) {
        throw new ApiError(400, "username & password  is required");
    }

    const user = await Admin.create({ username, password });

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    return res
        .status(200)
        .json(new ApiResponse(200, { user, accessToken, refreshToken }, "User logged in successfully"));
});

// Add Notification endpoint
export const addNotifications = asyncHandler(async (req, res) => {
    const { title, message, sourceType } = req.body;

    try {
        // Create a new notification
        const newNotification = new Notification({
            title,
            message,
            sourceType,
            sourceUrl: req.file?.filename ?? ""
        });

        let users = await User.find({}, { fcmToken: 1, isMainNotificationOn: 1 });

        users.forEach((user) => {
            console.log(user);
            if (
                user.fcmToken != undefined &&
                user.isMainNotificationOn != undefined &&
                user.isMainNotificationOn == true
            ) {
                sendNotifcationWithFirebase(user.fcmToken, {
                    title: title,
                    body: message
                    // sourceType,
                    // sourceUrl: req.file?.filename ?? ""
                });
            }
        });

        // Save the notification to the database
        const savedNotification = await newNotification.save();

        return res.status(201).json(new ApiResponse(201, savedNotification));
    } catch (error) {
        console.log(error);
        throw new ApiError(500, error);
    }
});
/// Get Total Notifications
export const getTotalNotifications = asyncHandler(async (req, res) => {
    let filter = {};

    try {
        const totalNotifications = await Notification.find(filter).sort({ createdAt: -1 });

        return res.status(200).json(new ApiResponse(200, totalNotifications));
    } catch (error) {
        console.log(error);

        throw new ApiError(500, error);
    }
});

// Toggle Withdrawal Request
export const toggleWithdrawalRequest = asyncHandler(async (req, res) => {
    try {
        const admin = await Admin.findOne();

        const updatedAdmin = await Admin.findByIdAndUpdate(
            admin._id,
            {
                isWithdrwalOn: admin.isWithdrwalOn == true ? false : true
            },
            {
                new: true
            }
        );

        return res.status(200).json(new ApiResponse(200, updatedAdmin));
    } catch (error) {
        console.error("Something went wrong : " + error);
        throw new ApiError(500, error);
    }
});

/// Get User Dashboard Data
export const getUserDashboardData = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.findById(id);

        const lastCredit = await Transaction.find(
            {
                userId: id,
                transactionType: "DEBIT"
            },
            { transactionAmount: 1, userId: 1, createdAt: 1 }
        )
            .sort({ createdAt: -1 })
            .limit(1);

        const lastWithdrawal = await Transaction.find(
            {
                userId: id,
                transactionType: "CREDIT"
            },
            { transactionAmount: 1, userId: 1, createdAt: 1 }
        )
            .sort({ createdAt: -1 })
            .limit(1);

        const totalBids = await Biding.find({ userId: id });
        console.log(totalBids.length);

        const creditDebitFundList = await Transaction.find({
            userId: id,
            transactionType: { $in: ["ADD", "WITHDRAWAL"] }
        }).sort({ createdAt: -1 });

        return res.status(200).json(
            new ApiResponse(200, {
                lastCredit: lastCredit[0] == undefined ? 0 : lastCredit[0]["transactionAmount"],
                lastWithdrawal: lastWithdrawal[0] == undefined ? 0 : lastWithdrawal[0]["transactionAmount"],
                currentWalletAmount: user.walletAmount,
                totalBids: totalBids.length,
                creditDebitFundList
            })
        );
    } catch (error) {
        console.error("Something went wrong : " + error);
        throw new ApiError(500, error);
    }
});

// Add or Update Web Setting
export const addOrUpdateAdmin = asyncHandler(async (req, res) => {
    const requestBody = req.body;

    try {
        let filter = { username: requestBody["username"] };
        const admin = await Admin.findOne(filter);

        if (!admin) {
            throw new ApiError(500, "Error");
        }

        const result = await Admin.findOneAndUpdate(
            filter,
            {
                $set: {
                    avatar: req.file?.filename || admin.avatar,
                    ...requestBody
                }
            },
            { new: true }
        );

        return res.status(201).json(new ApiResponse(200, result));
    } catch (error) {
        console.error("Error adding/updating admin:", error);
        throw new ApiError(500, "Error adding/updating admin:" + error);
    }
});

/// Get Admin Dashboard Data
export const getAdminDashboardData = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    let date = new Date().toJSON();
    let todayDate = date.split("T")[0];

    let yesterdayDate = new Date(new Date().setDate(new Date().getDate() - 1)).toJSON().split("T")[0];
    let thisWeekStartDate = new Date(new Date().setDate(new Date().getDate() - ((new Date().getDay() + 6) % 7)))
        .toJSON()
        .split("T")[0];
    let lastWeekStartDate = new Date(new Date().setDate(new Date().getDate() - ((new Date().getDay() + 6) % 7) - 7))
        .toJSON()
        .split("T")[0];
    let thisMonthStartDate = new Date(new Date().setDate(1)).toJSON().split("T")[0];
    let lastMonthStartDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toJSON().split("T")[0];

    let filter = {};

    if (startDate) {
        filter.createdAt = { $gte: new Date(`${startDate}T00:00:00.000Z`), $lte: new Date(`${endDate}T23:59:59.999Z`) };
        todayDate = startDate;
        yesterdayDate = new Date(new Date(startDate).setDate(new Date(startDate).getDate() - 1)).toJSON().split("T")[0];
    }

    console.log(new Date(`${todayDate}T00:00:00.000Z`));
    console.log(new Date(`${todayDate}T23:59:59.999Z`));

    try {
        const user = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsersCount: {
                        $sum: 1
                    },
                    totalWalletAmount: {
                        $sum: { $cond: [{ $eq: ["$isBlocked", false] }, "$walletAmount", 0] }
                    },
                    totalLoggedInUsersCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: [{ $ifNull: ["$token", null] }, null] },
                                        { $eq: ["$isBlocked", false] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    totalUnLoggedInUsersCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: [{ $ifNull: ["$token", null] }, null] },
                                        { $eq: ["$isBlocked", false] }
                                    ]
                                },
                                0,
                                1
                            ]
                        }
                    },
                    totalActiveUsersCount: {
                        $sum: { $cond: [{ $eq: ["$isBlocked", false] }, 1, 0] }
                    },
                    totalZeroBalanceUsersCount: {
                        $sum: { $cond: [{ $eq: ["$walletAmount", 0] }, 1, 0] }
                    },
                    totalUnBlockedUsersCount: {
                        $sum: { $cond: [{ $eq: ["$isBlocked", false] }, 1, 0] }
                    },
                    totalBlockedUsersCount: {
                        $sum: { $cond: [{ $eq: ["$isBlocked", true] }, 1, 0] }
                    },
                    todayZeroBalanceUsersCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ["$createdAt", new Date(`${todayDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${todayDate}T23:59:59.999Z`)] },
                                        { $eq: ["$isBlocked", false] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    todayRegisteredUsersCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ["$createdAt", new Date(`${todayDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${todayDate}T23:59:59.999Z`)] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    yesterdayRegisteredUsersCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ["$createdAt", new Date(`${yesterdayDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${yesterdayDate}T23:59:59.999Z`)] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    thisWeekRegisteredUsersCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ["$createdAt", new Date(`${thisWeekStartDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${todayDate}T23:59:59.999Z`)] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    lastWeekRegisteredUsersCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ["$createdAt", new Date(`${lastWeekStartDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${thisWeekStartDate}T23:59:59.999Z`)] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    thisMonthRegisteredUsersCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ["$createdAt", new Date(`${thisMonthStartDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${todayDate}T23:59:59.999Z`)] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    lastMonthRegisteredUsersCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ["$createdAt", new Date(`${lastMonthStartDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${thisMonthStartDate}T23:59:59.999Z`)] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    todayZeroBalanceUsersCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$walletAmount", 0] },
                                        { $gte: ["$createdAt", new Date(`${todayDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${todayDate}T23:59:59.999Z`)] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const periodicData = await HistoryData.findOne(
            {
                createdAt: {
                    $gte: new Date(`${todayDate}T00:00:00.000Z`),
                    $lte: new Date(`${todayDate}T23:59:59.999Z`)
                }
            },
            {
                walletAmount: 1
            }
        );

        const totalBids = await Biding.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: "$null",
                    totalAmount: {
                        $sum: "$gameAmount"
                    },
                    todayBidsAmount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ["$createdAt", new Date(`${todayDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${todayDate}T23:59:59.999Z`)] }
                                    ]
                                },
                                "$gameAmount",
                                0
                            ]
                        }
                    },
                    totalExposureBalance: {
                        $sum: {
                            $cond: [{ $and: [{ $eq: ["$resultStatus", "PENDING"] }] }, "$gameAmount", 0]
                        }
                    },
                    todayExposureBalance: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$resultStatus", "PENDING"] },
                                        { $gte: ["$createdAt", new Date(`${todayDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${todayDate}T23:59:59.999Z`)] }
                                    ]
                                },
                                "$gameAmount",
                                0
                            ]
                        }
                    },
                    todayWinAmount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$resultStatus", "WIN"] },
                                        { $gte: ["$createdAt", new Date(`${todayDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${todayDate}T23:59:59.999Z`)] }
                                    ]
                                },
                                "$winAmount",
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const totalTransactions = await Transaction.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: "$null",
                    totalPaidAmount: {
                        $sum: "$transactionAmount"
                    },
                    todayTotalDiposits: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$transactionType", "CREDIT"] },
                                        { $eq: ["$paymentFor", "fund"] },
                                        { $in: ["$addedBy", ["self", "Admin", "admin"]] },
                                        { $gte: ["$createdAt", new Date(`${todayDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${todayDate}T23:59:59.999Z`)] }
                                    ]
                                },
                                "$transactionAmount",
                                0
                            ]
                        }
                    },
                    todayTotalWithdrawals: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $in: ["$transactionType", ["WITHDRAW", "DEBIT"]] },
                                        { $eq: ["$paymentFor", "fund"] },
                                        { $in: ["$transactionStatus", ["APPROVED", "SUCCESS"]] },
                                        { $in: ["$addedBy", ["self", "Admin", "admin"]] },
                                        { $gte: ["$createdAt", new Date(`${todayDate}T00:00:00.000Z`)] },
                                        { $lte: ["$createdAt", new Date(`${todayDate}T23:59:59.999Z`)] }
                                    ]
                                },
                                "$transactionAmount",
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        console.log(totalTransactions[0]?.todayTotalWithdrawals ?? 0);
        return res.status(200).json(
            new ApiResponse(200, {
                totalUsersCount: user[0]?.totalUsersCount ?? 0,
                totalBidsAmount: totalBids[0]?.totalAmount ?? 0,
                todayBidsAmount: totalBids[0]?.todayBidsAmount ?? 0,
                totalWalletAmount: user[0]?.totalWalletAmount ?? 0,
                totalPaidAmount: totalTransactions[0]?.totalPaidAmount ?? 0,
                todayWinAmount: totalBids[0]?.todayWinAmount ?? 0,
                totalLoggedinUsersCount: user[0]?.totalLoggedInUsersCount ?? 0,
                totalUnLoggedinUsersCount: user[0]?.totalUnLoggedInUsersCount ?? 0,
                totalZeroBalanceUsersCount: user[0]?.totalZeroBalanceUsersCount ?? 0,
                todayZeroBalanceUsersCount: user[0]?.todayZeroBalanceUsersCount ?? 0,
                totalBlockedUsersCount: user[0]?.totalBlockedUsersCount ?? 0,
                todayTotalDiposits: totalTransactions[0]?.todayTotalDiposits ?? 0,
                todayTotalWithdrawals: totalTransactions[0]?.todayTotalWithdrawals ?? 0,
                yesterdayWalletBalance: periodicData?.walletAmount ?? 0,
                totalExposureBalance: totalBids[0]?.totalExposureBalance ?? 0,
                todayExposureBalance: totalBids[0]?.todayExposureBalance ?? 0,
                todayRegisteredUsersCount: user[0]?.todayRegisteredUsersCount ?? 0,
                yesterdayRegisteredUsersCount: user[0]?.yesterdayRegisteredUsersCount ?? 0,
                thisWeekRegisteredUsersCount: user[0]?.thisWeekRegisteredUsersCount ?? 0,
                lastWeekRegisteredUsersCount: user[0]?.lastWeekRegisteredUsersCount ?? 0,
                thisMonthRegisteredUsersCount: user[0]?.thisMonthRegisteredUsersCount ?? 0,
                lastMonthRegisteredUsersCount: user[0]?.lastMonthRegisteredUsersCount ?? 0,
                totalUnBlockedUsersCount: user[0]?.totalUnBlockedUsersCount ?? 0
            })
        );
    } catch (error) {
        console.error("Something went wrong : " + error);
        throw new ApiError(500, error);
    }
});
