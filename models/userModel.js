import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { updateTimestamps } from "../utils/timezoneConversion.js";

// USER SCHEMA 
const userSchema = new Schema({
    srNo: {
        type: Number,
        required: true
    },
    joinedBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'joinedByType',  // <- Dynamically point to correct model
        required: true
    },
    joinedByType: {
        type: String,
        required: true,
        enum: ['Admin', 'User']
    },
    uplines: [{
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'joinedByType'
    }],
    role: {
        type: String,
        required: true,
        enum: ['super', 'master', 'client']
    },
    uid: {
        type: String
    },
    name: {
        type: String,
        required: true,
        trim: true,
        default: "",
    },
    username: {
        type: String,
        required: true,
        unique: true,
        lowecase: true,
        trim: true,
        index: true
    },
    mobile: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    avatar: {
        type: String, // url
        // required: true,
    },
    password: {
        type: String,
        required: [true, 'Password is required']
    },
    mpin: {
        type: Number,
        maxlength: 4
    },
    deviceName: {
        type: String,
        // required: [true, 'Device name is required']
    },
    gameExposure: {
        type: Number,
        required: true,
        default: 0
    },
    isBetLock: {
        type: Boolean,
        default: false
    },
    isBlocked: {
        type: Boolean,
        required: true,
        default: false
    },
    accountHolderName: {
        type: String,
        trim: true,
    },
    accountNumber: {
        type: String,
        trim: true,
    },
    bankName: {
        type: String,
        trim: true,
    },
    branchName: {
        type: String,
        trim: true,
    },
    ifscCode: {
        type: String,
        trim: true,
    },
    phonePeNumber: {
        type: String,
        trim: true
    },
    paytmNumber: {
        type: String,
        trim: true
    },
    gPayNumber: {
        type: String,
        trim: true
    },
    upiId: {
        type: String,
        trim: true
    },
    walletAmount: {
        type: Number,
        required: true,
        default: 0
    },
    referralCode: {
        type: String,
    },
    otp: { type: String },
    otpExpiry: { type: Date },
    token: { type: Object },
    fcmToken: { type: String },
    isMainNotificationOn: { type: Boolean, default: true }, // -> REGULAR BAZAR RESULT
    isGameNotificationOn: { type: Boolean, default: true }, // -> WINNER NOTIFICATION
    isStarLineNotificationOn: { type: Boolean, default: true }, // -> DHANLAXMI & MAHALAXMI


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

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};
userSchema.methods.isMpinCorrect = async function (mpin) {
    return (mpin == this.mpin);
};

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            username: this.username,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
};

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
};


/// ADMIN SCHEMA 
const adminSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowecase: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        default: "",
    },
    email: {
        type: String,
        required: true,
        trim: true,
        default: "",
    },
    mobile: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    avatar: {
        type: String, // url
        // required: true,
    },
    password: {
        type: String,
        required: true,
        required: [true, 'Password is required']
    },
    address: {
        type: String,
        required: true,
        trim: true,
        default: "",
    },
    pincode: {
        type: String,
        required: true,
        trim: true,
        default: "",
    },
    gender: {
        type: String,
        required: true,
        trim: true,
        default: "",
    },
    dob: {
        type: String,
        required: true,
        trim: true,
        default: "",
    },
    isWithdrwalOn: {
        type: Boolean,
        required: true,
        default: false
    },
    isGameNotificationOn: { type: Boolean, default: true }, // -> Game Result / Game Winner 

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

const otpSchema = new Schema({
    mobile: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    otp: { type: String },
    otpExpiry: { type: Date },
})



userSchema.pre("save", updateTimestamps);
adminSchema.pre("save", updateTimestamps);
otpSchema.pre("save", updateTimestamps);


export const User = mongoose.model("User", userSchema)

export const Admin = mongoose.model("Admin", adminSchema)

export const OtpModel = mongoose.model("Otp", otpSchema)