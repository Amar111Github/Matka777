import mongoose, { Schema } from "mongoose";

import { GameRatesEnums, GameRatesEnumsList, GameTypeEnums, TransactionPaymentEnums, TransactionTypeEnums } from "../constants/constants.js";
import moment from "moment-timezone";
import { updateTimestamps } from "../utils/timezoneConversion.js";


const transactionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    gameId: {
        type: Schema.Types.ObjectId,
        ref: "Game"
    },
    transactionId: {
        type: String,
        required: true,
        default: ""
    },
    transactionType: {
        type: String,
        enum: TransactionTypeEnums,
    },
    transactionStatus: {
        type: String,
        enum: TransactionPaymentEnums,
        default: TransactionPaymentEnums.PENDING
    },
    previousAmount: {
        type: Number,
        default: 0,
        required: true
    },
    transactionAmount: {
        type: Number,
        default: 0,
        required: true
    },
    currentAmount: {
        type: Number,
        default: 0,
        required: true
    },
    gameType: {
        type: String
    },
    gameName: {
        type: String
    },
    description: {
        type: String
    },
    payDate: {
        type: String
    },
    addedBy: {
        type: String,// auto, admin, self
        trime: true,
        required: true,
    },
    paymentFor: {
        type: String,// bid, fund
        trime: true,
        required: true,
    },
    gameSession: {
        type: String,
        enum: ["OPEN", "CLOSE"],
    },
    gameType: {
        type: String,
        // enum: GameRatesEnumsList,
    },
    resultDate: {
        type: Date
    },
    upiId: {
        type: String,
        default: ""
    },


},
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret) {
                delete ret.__v;
            }
        }
    },

)

const historyDataSchema = new Schema({

    bidAmount: {
        type: Number,
        default: 0,
        required: true
    },
    winAmount: {
        type: Number,
        default: 0,
        required: true
    },
    withdrawalAmount: {
        type: Number,
        default: 0,
        required: true
    },
    dipositAmount: {
        type: Number,
        default: 0,
        required: true
    },
    walletAmount: {
        type: Number,
        default: 0,
        required: true
    }
},
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret) {
                delete ret.__v;
            }
        }
    },

)

historyDataSchema.userId = {
    type: Schema.Types.ObjectId,
    ref: "User"
};

const upiDataSchema = new Schema({
    scanner: {
        type: String,
        required: true
    },
    upi: {
        type: String,
        required: true
    },
    status: {
        type: Boolean,
        required: true,
        default: false
    },
    isPrimary: {
        type: Boolean,
        required: true,
        default: false
    },
    payeeName: {
        type: String
    },
    description: {
        type: String
    }
},
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret) {
                delete ret.__v;
            }
        }
    },
)

transactionSchema.pre("save", updateTimestamps);
historyDataSchema.pre("save", updateTimestamps);
upiDataSchema.pre("save", updateTimestamps);
transactionSchema.path('updatedAt').set(function (value) {
    // Convert the UTC timestamp to IST
    const updatedTimeIST = moment(value).tz('Asia/Kolkata');
    // Return the formatted IST timestamp
    return updatedTimeIST.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
});

export const Transaction = mongoose.model("Transaction", transactionSchema)

export const HistoryData = mongoose.model("HistoryData", historyDataSchema)

export const UserHistoryData = mongoose.model("UserHistoryData", historyDataSchema);

export const UpiData = mongoose.model("upiData", upiDataSchema)

