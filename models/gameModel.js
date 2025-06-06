import mongoose, { Schema } from "mongoose";
import {
    GameCategoryEnums,
    GameRatesEnums,
    GameResultEnums,
    GameTypeEnums,
    WeekDaysEnums
} from "../constants/constants.js";
import moment from "moment-timezone";
import { updateTimestamps } from "../utils/timezoneConversion.js";


const gameSchema = new Schema({

    gameIndex: {
        type: Number,
        trim: true,
        required: true,
        default: 0
    },
    gameName: {
        type: String,
        required: true,
        trim: true
    },
    gameCategory: {
        type: String,
        enum: GameCategoryEnums,
        default: GameCategoryEnums.DAY_GAME
    },
    openNumber: {
        type: String,
        trim: true
    },
    closeNumber: {
        type: String,
        trim: true
    },
    resultNumber: {
        type: String,
        trim: true
    },
    guessingNumber: {
        type: String,
        trim: true
    },
    activeStatus: {
        type: Boolean,
        required: [true, 'Status is required'],
        default: true
    },
    holidayStatus: {
        type: Boolean,
        required: [true, 'Status is required'],
        default: false
    },
    highlightStatus: {
        type: Boolean,
        required: [true, 'Highlight Status is required'],
        default: false
    },
    gameExposure: {
        type: Number,
        required: true,
        default: 0
    },
    resultDeclareDate: {
        type: Date
    },
    isWebShow: {
        type: Boolean,
        default: true
    },
    isWebAnkShow: {
        type: Boolean,
        default: true
    },
    gameDayCount: {
        type: Number,
        default: 7
    },
    lastOpenNumber: {
        type: String,
        trim: true
    },
    lastCloseNumber: {
        type: String,
        trim: true
    },
    lastResultNumber: {
        type: String,
        trim: true
    },
    openWebResultTime: {
        type: Date
    },
    closeWebResultTime: {
        type: Date
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


const gameTimingSchema = new Schema({

    gameId: {
        type: Schema.Types.ObjectId,
        ref: "Game",
        required: true,
    },
    gameDay: {
        type: String,
        enum: WeekDaysEnums,
        required: true
    },
    isOpen: {
        type: Boolean,
        default: true,
        required: true
    },
    gameCategory: {
        type: String,
        enum: GameCategoryEnums,
        required: true
    },
    openBidTime: {
        type: Date,
        required: [true, 'Open bid time is required']
    },
    closeBidTime: {
        type: Date,
        required: [true, 'Open bid time is required']
    },
    openBidResultTime: {
        type: Date,
        required: [true, 'Open bid result time is required']
    },
    closeBidResultTime: {
        type: Date,
        required: [true, 'Close bid result time is required']
    },
    isWebShow: {
        type: Boolean,
        default: true
    },
    isWebAnkShow: {
        type: Boolean,
        default: true
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


const gameTypeSchema = new Schema({

    gameId: {
        type: Schema.Types.ObjectId,
        ref: "Game",
        required: true,
    },
    gameType: {
        type: String,
        enum: GameTypeEnums,
        required: true
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


const gameRatesSchema = new Schema({

    gameId: {
        type: Schema.Types.ObjectId,
        ref: "Game",
        required: true,
    },
    gameType: {
        type: String,
        // enum: GameRatesEnums,
        required: true
    },
    gamePrice: {
        type: Number,
        required: true,
        default: 0
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

const gameResultSchema = new Schema({

    gameId: {
        type: Schema.Types.ObjectId,
        ref: "Game",
        required: true
    },
    gameCategory: {
        type: String,
        enum: GameCategoryEnums,
        required: true
    },
    openResultNumber: {
        type: String,
        trim: true,
    },
    closeResultNumber: {
        type: String,
        trim: true,
    },
    gameResultNumber: {
        type: String,
        trim: true,
    },
    guessingNumber: {
        type: String,
        trim: true
    },
    resultDeclareDate: {
        type: Date,
        required: [true, 'Result declare date is required']
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

)

gameSchema.pre("save", updateTimestamps);
gameTimingSchema.pre("save", updateTimestamps);
gameTypeSchema.pre("save", updateTimestamps);
gameRatesSchema.pre("save", updateTimestamps);
gameResultSchema.pre("save", updateTimestamps);
gameResultSchema.path('updatedAt').set(function (value) {
    // Convert the UTC timestamp to IST
    const updatedTimeIST = moment(value).tz('Asia/Kolkata');
    // Return the formatted IST timestamp
    return updatedTimeIST.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
});


export const Game = mongoose.model("Game", gameSchema)

export const GameTimings = mongoose.model("GameTiming", gameTimingSchema)

export const GameType = mongoose.model("GameType", gameTypeSchema)

export const GameRates = mongoose.model("GameRate", gameRatesSchema)

export const GameResultModel = mongoose.model("GameResult", gameResultSchema)






