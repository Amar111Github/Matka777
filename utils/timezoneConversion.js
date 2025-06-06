import moment from "moment-timezone";

export const updateTimestamps = function (next) {
    const currentTimeIST = moment().tz('Asia/Kolkata');
    // Format the current time as required
    const formattedTime = currentTimeIST.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
    this.updatedAt = formattedTime;
    this.createdAt = formattedTime;
    console.log(`updatedAt `+this.updatedAt);
    next();
};
