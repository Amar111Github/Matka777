import mongoose, { Schema } from "mongoose";
import { WeekDaysEnums } from "../constants/constants.js";
import { updateTimestamps } from "../utils/timezoneConversion.js";

const appSettingSchema = new Schema({

    appMessage: {
        type: String,
        required: true,
        default: ""
    },
    appRunningHomeText: {
        type: String,
        required: true,
        default: ""
    },
    withdrawalText: {
        type: String,
        required: true,
        default: ""
    },
    withdrawalDescription: {
        type: String,
        required: true,
        default: ""
    },
    withdrawalNumber: {
        type: String,
        required: true,
        default: ""
    },
    whatsAppNumber: {
        type: String,
        required: true,
        default: ""
    },
    mobileNumber: {
        type: String,
        required: true,
        default: ""
    },
    supportNumber: {
        type: String,
        required: true,
        default: ""
    },
    appVersion: {
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

);

const withdrawSettingSchema = new Schema({

    withdrawDay: {
        type: String,
        enum: WeekDaysEnums,
        required: true
    },
    withdrawStatus: {
        type: Boolean,
        default: true,
        required: true
    },
    openWithdrawTime: {
        type: Date,
        required: [true, 'Open bid time is required']
    },
    closeWithdrawTime: {
        type: Date,
        required: [true, 'Open bid time is required']
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

);


const webSettingSchema = new Schema({

    digit: {
        type: Number,
        required: true,
        default: 10
    },
    jodi: {
        type: Number,
        required: true,
        default: 100
    },
    singlePana: {
        type: Number,
        required: true,
        default: 160
    },
    doublePana: {
        type: Number,
        required: true,
        default: 320
    },
    triplePana: {
        type: Number,
        required: true,
        default: 1000
    },
    halfSangam: {
        type: Number,
        required: true,
        default: 1500
    },
    fullSangam: {
        type: Number,
        required: true,
        default: 15000
    },
    mobileNumber: {
        type: String,
        required: true,
        default: ""
    },
    whatsAppNumber: {
        type: String,
        required: true,
        default: ""
    },
    supportNumber: {
        type: String,
        required: true,
        default: ""
    },
    videoUrl: {
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

);


const notificationSchema = new Schema({

    title: {
        type: String,
        required: true,
        default: ""
    },
    message: {
        type: String,
        required: true,
        default: ""
    },
    sourceType: {
        type: String,
        required: true,
        default: "message"
    },
    sourceUrl: {
        type: String,
        default: ""
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

);

const videoSchema = new Schema({

    language: {
        type: String,
        required: true,
        default: ""
    },
    vTitle: {
        type: String,
        required: true,
        default: ""
    },
    vDescription: {
        type: String,
        required: true,
        default: ""
    },
    vUrl: {
        type: String,
        required: true,
        default: ""
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
);


appSettingSchema.pre("save", updateTimestamps);
withdrawSettingSchema.pre("save", updateTimestamps);
webSettingSchema.pre("save", updateTimestamps);
notificationSchema.pre("save", updateTimestamps);
videoSchema.pre("save", updateTimestamps);

export const AppSetting = mongoose.model("AppSetting", appSettingSchema);

export const WithdrawSetting = mongoose.model("WithdrawSetting", withdrawSettingSchema);

export const WebSetting = mongoose.model("WebSetting", webSettingSchema);

export const Notification = mongoose.model("Notification", notificationSchema);

export const VideoModel = mongoose.model("Video", videoSchema);