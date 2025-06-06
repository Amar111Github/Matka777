import mongoose, { Schema } from "mongoose";

import { GameTypeEnums, GameCategoryEnums, GameResultEnums, GameRatesEnumsList } from "../constants/constants.js";
import moment from "moment-timezone";

const bidingSchema = new Schema(
    {
        uplines: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: ["Admin", "User"]
            }
        ],
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        gameId: {
            type: Schema.Types.ObjectId,
            ref: "Game",
            required: true
        },
        gameName: {
            type: String,
            required: true,
            lowecase: true,
            trim: true,
            index: true
        },
        gameType: {
            type: String,
            enum: GameTypeEnums,
            required: true
        },
        gameRateType: {
            type: String
            // enum: GameRatesEnumsList,
            // required: true,
        },
        gameSession: {
            type: String,
            enum: ["OPEN", "CLOSE"],
            required: true
        },
        gameCategory: {
            type: String,
            enum: GameCategoryEnums,
            default: GameCategoryEnums.DAY_GAME
        },
        gameNumber: {
            type: String,
            required: true,
            trim: true
        },
        gameAmount: {
            type: Number,
            required: true,
            trim: true,
            default: 0
        },
        winAmount: {
            type: Number,
            required: true,
            trim: true,
            default: 0
        },
        resultStatus: {
            type: String,
            enum: GameResultEnums,
            required: true,
            trim: true,
            default: GameResultEnums.PENDING
        },
        resultDeclareDate: {
            type: Date,
            default: Date.now()
        },
        updatedBy: {
            type: String,
            enum: ["PENDING", "OPEN", "CLOSE"],
            required: true,
            default: "PENDING"
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret) {
                delete ret.__v;
            }
        }
    }
);

bidingSchema.pre("save", async function (next) {
    const currentTimeIST = moment().tz("Asia/Kolkata");
    // Format the current time as required
    const formattedTime = currentTimeIST.format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
    this.updatedAt = formattedTime;
    this.resultDeclareDate = formattedTime;
    this.createdAt = formattedTime;
    next();
});

export const Biding = mongoose.model("Biding", bidingSchema);
