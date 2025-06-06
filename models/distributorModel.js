import mongoose, { Schema } from "mongoose";
import { updateTimestamps } from "../utils/timezoneConversion.js";


const partyGameRateSchema = new Schema({
    role: {
        type: String,
        required: true,
        enum: ['super', 'master', 'client']
    },
    // super, master
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Party',
        required: true
    },
    gameId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game',
        required: true
    },
    open: Number,
    close: Number,
    jodi: Number,
    singlePanna: Number,
    doublePanna: Number,
    triplaPanna: Number,
    SP: Number,// Means all single panna
    DP: Number,
    TP: Number,
    JP: Number,
    halfSangamGunle: Number,
    commission: {
        admin: Number,
        super: Number,
        master: Number,
        client: Number // USER
    },
    partnership: {
        admin: Number,
        super: Number,
        master: Number,
        client: Number // USER
    }
}, { timestamps: true });

partyGameRateSchema.pre("save", updateTimestamps);

export const PartyGameRate = mongoose.model("PartyGameRate", partyGameRateSchema)
