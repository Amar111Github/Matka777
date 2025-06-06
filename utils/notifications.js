import https from 'https';
import { JWT } from "google-auth-library";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

const key = {
  
}



// For Generate Access Token 
export const generateAccessToken = asyncHandler(async (req, res) => {

//     const jwtClient = new JWT(
//         key.client_email,
//         null,
//         key.private_key,
//         SCOPES,
//         null
//     );

//     jwtClient.authorize(function (err, tokens) {
//         if (err) {
//             console.log(err);
//             throw new ApiError(401, err)
//         }
//         return res.send(tokens.access_token);
//     });

// })


// // For Sending Notification 
// export const sendNotification = asyncHandler(async (req, res) => {

//     const { fcmToken, body, title, data } = req.body;


//     const jwtClient = new JWT(
//         key.client_email,
//         null,
//         key.private_key,
//         SCOPES,
//         null
//     );
//     jwtClient.authorize(function (err, tokens) {
//         if (err) {
//             reject(err);
//             throw new ApiError(401, err)

//         }
//         const accessToken = tokens.access_token;

//         const uri = 'https://fcm.googleapis.com/v1/projects/matka444app/messages:send';

//         fetch(uri, {
//             method: "POST",
//             body: JSON.stringify({
//                 "message": {
//                     "token": fcmToken,
//                     "notification": {
//                         "body": body,
//                         "title": title
//                     },
//                     "data": data,
//                 }
//             }),
//             headers: {
//                 "Content-type": "application/json",
//                 "Authorization": `Bearer ${accessToken}`
//             }
//         })
//             // Converting to JSON 
//             .then(response => response.json())
//             // Displaying results to console 
//             .then((json) => {
//                 res.json(json)
//             });
//     });
});

export const sendNotifcationWithFirebase = async (notificationId, data) => {

    // const jwtClient = new JWT(
    //     key.client_email,
    //     null,
    //     key.private_key,
    //     SCOPES,
    //     null
    // );
    // jwtClient.authorize(function (err, tokens) {
    //     if (err) {
    //         reject(err);
    //         throw new ApiError(401, err)

    //     }
    //     const accessToken = tokens.access_token;

    //     const uri = 'https://fcm.googleapis.com/v1/projects/matka444app/messages:send';

    //     console.log(uri);
    //     console.log(data);
    //     console.log(notificationId);

    //     fetch(uri, {
    //         method: "POST",
    //         body: JSON.stringify({
    //             "message": {
    //                 "token": notificationId,
    //                 "notification": data,
    //                 "data": data,
    //             }
    //         }),
    //         headers: {
    //             "Content-type": "application/json",
    //             "Authorization": `Bearer ${accessToken}`
    //         }
    //     })
    //         // Converting to JSON 
    //         .then(response => response.json())
    //         // Displaying results to console 
    //         .then((json) => {
    //             console.log(json);
    //              return json;
    //         });
    // });

}
// export const sendNotifcationWithFirebase = async (notificationId, data) => {
//     const serverKey = 'AAAArdWPWUU:APA91bFJlaDYz8_XqvZ7bTo-bM73jIpxDJaIAjg9kXjj9G3k0VneRj5QKoBnzKaEDJi3PT6mwrv-y4cBpI2MpR_66QWMbIXqHVlVed9WgVfCHbodh5XxGcdNOMjbn-ZHONqXqouZm-42';

//     try {

//         const postData = JSON.stringify({ to: notificationId, notification: data });

//         const options = {
//             hostname: 'fcm.googleapis.com',
//             path: '/fcm/send',
//             method: 'POST',
//             headers: {
//                 'Authorization': 'key=' + serverKey,
//                 'Content-Type': 'application/json',
//             },
//         };

//         const req = https.request(options, (res) => {
//             let response = '';

//             res.setEncoding('utf8');

//             res.on('data', (chunk) => {
//                 response += chunk;
//                 console.log(response);
//             });

//             res.on('end', () => {
//                 console.log('Notification sent:', response);
//             });
//         });

//         req.on('error', (error) => {
//             console.error('Error sending notification:', error);
//         });

//         req.write(postData);
//         req.end();
//     } catch (e) {
//         console.error(e);
//     }
// };
