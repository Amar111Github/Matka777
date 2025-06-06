import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Game } from "../models/gameModel.js";
import { PartyGameRate } from "../models/distributorModel.js";
import { User } from "../models/userModel.js";
import { Admin } from "../models/userModel.js";
import mongoose, { Schema } from "mongoose";

// Get all games
export const getGames = asyncHandler(async (req, res) => {

    let filter = {};
    const { gameCategory } = req.query;
    if (gameCategory) {
        filter.gameCategory = gameCategory;
    }

    const games = await Game.find(filter, { gameName: 1, gameCategory: 1 });

    return res.status(200).json(new ApiResponse(200, games, "Games fetched successfully"));
});
/// Add a new party
export const addParty = asyncHandler(async (req, res) => {
    const { joinedBy, joinedByType, role, name, username, mobile, password, walletAmount } = req.body;

    const existedParty = await User.findOne({ $or: [{ username }, { mobile }] });

    if (existedParty) {
        throw new ApiError(409, "Party with mobile or username already exists", []);
    }

    let srNo;
    const lastParty = await User.findOne({}, { srNo: 1 }).sort({ srNo: -1 });
    if (lastParty && lastParty.srNo) {
        srNo = lastParty.srNo + 1;
    } else {
        srNo = 1;
    }

    let uplines = [];

    if (joinedBy != null && joinedByType != null) {

        if (joinedByType == "Admin") {
            const admin = await Admin.findOne({ _id: joinedBy });
            // console.log(admin);

            uplines.push(new mongoose.Types.ObjectId(joinedBy));

            if (!admin) {
                throw new ApiError(404, "Admin not found");
            }
        } else if (joinedByType == "Party") {
            const party = await User.findOne({ _id: joinedBy });

            console.log(party);
            uplines.push.apply(uplines, User.uplines);

            uplines.push(new mongoose.Types.ObjectId(joinedBy));


            if (!party) {
                throw new ApiError(404, "Party not found");
            }
        }
        else {
            throw new ApiError(400, "Invalid joinedByType");
        }
    }


    console.log(uplines);


    // return;

    const createdParty = await User.create({
        srNo,
        joinedBy,
        joinedByType,
        uplines,
        role,
        name,
        username,
        mobile,
        password,
        walletAmount
    });

    if (!createdParty) {
        throw new ApiError(500, "Something went wrong while registering the party");
    }

    return res.status(201).json(new ApiResponse(201, createdParty, "Party registered successfully"));

});
// Get all parties
export const getParty = asyncHandler(async (req, res) => {

    const { search, joinedBy } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;


    let filter = {};

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { username: { $regex: search, $options: 'i' } },
            { mobile: { $regex: search, $options: 'i' } }
        ];
    }

    if (joinedBy) {
        filter.joinedBy = new mongoose.Types.ObjectId(joinedBy);
    }
    // const parties = await User.find()
    //     .populate({
    //         path: 'joinedBy',
    //         select: 'username',
    //     })
    //     .sort({ createdAt: -1 })
    //     .lean();

    const parties = await User.aggregate([
        {
            $match: filter
        },
        {
            $lookup: {
                from: 'parties',
                localField: 'joinedBy',
                foreignField: '_id',
                as: 'partyJoinedBy',
                pipeline: [{ $project: { username: 1 } }]
            }
        },
        {
            $lookup: {
                from: 'admins',
                localField: 'joinedBy',
                foreignField: '_id',
                as: 'adminJoinedBy',
                pipeline: [{ $project: { username: 1 } }]
            }
        },
        {
            $addFields: {
                joinedBy: {
                    $cond: {
                        if: { $eq: ['$joinedByType', 'Party'] },
                        then: { $arrayElemAt: ['$partyJoinedBy', 0] },
                        else: { $arrayElemAt: ['$adminJoinedBy', 0] }
                    }
                },
            }
        },
        {
            $project: {
                srNo: 1,
                joinedByType: 1,
                uplines: 1,
                role: 1,
                name: 1,
                username: 1,
                mobile: 1,
                password: 1,
                walletAmount: 1,
                isBetLock: 1,
                isBlocked: 1,
                createdAt: 1,
                updatedAt: 1,
                joinedBy: 1
            }
        },
        {
            $addFields: {
                gameExposure: 10
            }
        },
        {
            $addFields: {
                profitLoss: 10
            }
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }

    ]);

    if (!parties) {
        throw new ApiError(500, "Something went wrong while fetching parties");
    }

    return res.status(200).json(new ApiResponse(200, parties, "Parties fetched successfully"));
});
// Get party by ID
export const getPartyById = asyncHandler(async (req, res) => {
    const userId = req.params.userId;

    const party = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: 'parties',
                localField: 'joinedBy',
                foreignField: '_id',
                as: 'partyJoinedBy',
                pipeline: [{ $project: { username: 1 } }]
            }
        },
        {
            $lookup: {
                from: 'admins',
                localField: 'joinedBy',
                foreignField: '_id',
                as: 'adminJoinedBy',
                pipeline: [{ $project: { username: 1 } }]
            }
        },
        {
            $addFields: {
                joinedBy: {
                    $cond: {
                        if: { $eq: ['$joinedByType', 'Party'] },
                        then: { $arrayElemAt: ['$partyJoinedBy', 0] },
                        else: { $arrayElemAt: ['$adminJoinedBy', 0] }
                    }
                }
            }
        }
    ]);

    if (!party || User.length === 0) {
        throw new ApiError(404, "Party not found");
    }

    return res.status(200).json(new ApiResponse(200, party[0], "Party fetched successfully"));
})
// Update party by ID
export const updateParty = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { name, username, mobile, password, walletAmount } = req.body;

    const existingParty = await User.findById(userId);

    if (!existingParty) {
        throw new ApiError(404, "Party not found");
    }

    const duplicateParty = await User.findOne({
        $and: [
            { _id: { $ne: userId } },
            { $or: [{ username }, { mobile }] }
        ]
    });

    if (duplicateParty) {
        throw new ApiError(409, "Party with mobile or username already exists", []);
    }

    const updateFields = {};
    if (name) updateFields.name = name;
    if (username) updateFields.username = username;
    if (mobile) updateFields.mobile = mobile;
    if (password) updateFields.password = password;
    if (walletAmount) updateFields.walletAmount = walletAmount;

    const updatedParty = await User.findByIdAndUpdate(
        userId,
        updateFields,
        { new: true }
    );
    if (!updatedParty) {
        throw new ApiError(500, "Something went wrong while updating the party");
    }

    return res.status(200).json(new ApiResponse(200, updatedParty, "Party updated successfully"));
});
// Delete party by ID
export const deleteParty = asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    const deletedParty = await User.findByIdAndDelete(userId);
    if (!deletedParty) {
        throw new ApiError(404, "Party not found");
    }
    return res.status(200).json(new ApiResponse(200, deletedParty, "Party deleted successfully"));
});
// Add party rates
export const addPartyRates = asyncHandler(async (req, res) => {
    const { userId, gameId, open, close, jodi, singlePanna, doublePanna, triplaPanna, SP, DP, TP, JP, halfSangamGunle, commission, partnership } = req.body;

    const existedPartyRate = await PartyGameRate.findOne({
        $or: [
            ...(userId ? [{ userId }] : []),
            ...(userId ? [{ userId }] : [])
        ],
        gameId
    });
    if (existedPartyRate) {
        throw new ApiError(409, "Party rate for this game already exists", []);
    }

    const party = await User.findById(userId, { username: 1, role: 1 });
    if (!party) {
        throw new ApiError(404, "Party not found");
    }

    const createdPartyRate = await PartyGameRate.create({

        role: User.role,
        ...(userId && { userId }),
        ...(userId && { userId }),
        gameId,
        open,
        close,
        jodi,
        singlePanna,
        doublePanna,
        triplaPanna,
        SP,
        DP,
        TP,
        JP,
        halfSangamGunle,
        commission: {
            admin: commission?.admin || 0,
            super: commission?.super || 0,
            master: commission?.master || 0,
            client: commission?.client || 0
        },
        partnership: {
            admin: partnership?.admin || 0,
            super: partnership?.super || 0,
            master: partnership?.master || 0,
            client: partnership?.client || 0
        }
    });

    if (!createdPartyRate) {
        throw new ApiError(500, "Something went wrong while adding party rates");
    }

    return res.status(201).json(new ApiResponse(201, createdPartyRate, "Party rates added successfully"));

});
// Delete party rates
export const deletePartyRates = asyncHandler(async (req, res) => {
    const { userId, gameId } = req.body;

    const existedPartyRate = await PartyGameRate.findOne({
        userId,
        gameId
    });

    if (!existedPartyRate) {
        throw new ApiError(404, "Party rates not found", []);
    }

    const deletedPartyRate = await PartyGameRate.deleteMany({
        userId,
        gameId
    });
    if (!deletedPartyRate.deletedCount) {
        throw new ApiError(500, "Something went wrong while deleting party rates");
    }
    return res.status(200).json(new ApiResponse(200, deletedPartyRate, "Party rates deleted successfully"));

});
// Diposit chips
export const depositChips = asyncHandler(async (req, res) => {
    const { userId, walletAmount } = req.body;
    const party = await User.findById(userId, { walletAmount: 1 });
    console.log(party);

    if (!party) {
        throw new ApiError(404, "Party not found");
    }

    party.walletAmount = Number(party.walletAmount || 0) + Number(walletAmount || 0);
    const updatedParty = await party.save();
    return res.status(200).json(new ApiResponse(200, updatedParty, "Chips deposited successfully"));

});
// Party Account Action
export const partyAccountAction = asyncHandler(async (req, res) => {
    const { userId, isBlocked, isBetLock } = req.body;


    const party = await User.findById(userId, { isBlocked: 1, isBetLock: 1 });
    console.log(party);
    if (!party) {
        throw new ApiError(404, "Party not found");
    }

    if (isBlocked) {
        party.isBlocked = isBlocked;
        // BLOCK ALL USERS JOINED BY THIS PARTY
        await User.updateMany({ joinedBy: userId }, { isBlocked: isBlocked });
        await User.updateMany({ _id: { $in: await User.find({ joinedBy: userId }).distinct('_id') } }, { isBlocked: isBlocked });

    }
    if (isBetLock) {
        party.isBetLock = isBetLock;
        // BET LOCK ALL USERS JOINED BY THIS PARTY
        await User.updateMany({ joinedBy: userId }, { isBetLock: isBetLock });
        await User.updateMany({ _id: { $in: await User.find({ joinedBy: userId }).distinct('_id') } }, { isBetLock: isBetLock });
    }
    const updatedParty = await party.save();

    return res.status(200).json(new ApiResponse(200, updatedParty, "Party account action updated successfully"));

});


export const login = asyncHandler(async (req, res) => {
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

})

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
        console.log(error);
        throw new ApiError(500, "Something went wrong while generating the access token");
    }
};