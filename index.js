const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = 
[
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://mail.google.com/'
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listLabels(auth) {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.labels.list({
        userId: 'me',
    });
    const labels = res.data.labels;
    if (!labels || labels.length === 0) {
        console.log('No labels found.');
        return;
    }
    console.log('Labels:');
    labels.forEach((label) => {
        console.log(`- ${label.name}`);
    });
}

//authorize().then(listLabels).catch(console.error);
let labelName = "Vacation"
const repliedUsers = new Set()
const getUnreadMessagesandSendReply = async function (auth) {
    try {
        const gmail = google.gmail({ version: 'v1', auth });
        const res = await gmail.users.messages.list({
            userId: 'me',
            q: "is:unread"
        });
        const messages = res.data.messages
        console.log(messages)

         if (messages && messages.length > 0) {

            for (const message of messages) {
                const email = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id
                })
                //console.log(email)

                const from = email.data.payload.headers.find((header) => header.name === "From")
                const to = email.data.payload.headers.find((header) => header.name === "To")
                const subject = email.data.payload.headers.find((header) => header.name === "Subject")


                const From = from.value
                const To = to.value
                const Subject = subject.value

                // console.log("email came from - " , From)
                // console.log("email to - " , To)
                if(repliedUsers.has(From)){
                    console.log("Already replied to",From )
                    continue
                }
                const thread = await gmail.users.threads.get({
                    userId: 'me',
                    id: message.threadId
                })

                /// console.log(thread)

                const replies = thread.data.messages.slice(1)

                if (replies.length === 0) {
                    //Send message
                    await gmail.users.messages.send({
                        userId: 'me',
                        requestBody: {
                            raw: await createReplyRaw(To, From, Subject)
                        }
                    });

                    // Add label
                    
                    
                     gmail.users.messages.modify({
                        userId: 'me',
                        id: message.id,
                        requestBody: {
                            addLabelIds: await createLabelIfNeeded(auth)
                        }
                    })

                    console.log("reply sent to email", From)
                    repliedUsers.add(From)
                }


                //console.log(replies)
            }
         }
    }catch(err){
      console.log(err)
    }
    }


//reply msg creation
 async function createReplyRaw(from, to, subject) {
        const emailContent = `From: ${from}\nTo: ${to}\nSubject: ${subject}\n\nI am on Vacation.Connect you soon...`;
        const base64msg = Buffer.from(emailContent).toString('base64')
        return base64msg
    }
  
    //label creation
   const createLabelIfNeeded =  async function(auth) {
        const gmail = google.gmail({ version: 'v1', auth });
        const res = await gmail.users.labels.list({ userId: "me" });
        const labels = res.data.labels;
       //console.log(labels)
        const existinglabels = labels.find((label) => label.name === labelName);
        if (existinglabels) {
           // console.log(existinglabels)
            return existinglabels.id
            
        }

        const newLabel = await gmail.users.labels.create({
            userId: "me",
            requestBody: {
                name: labelName,
                labelListVisibility: "labelShow",
                messageListVisibility: "show"
            }

        })
       // console.log(newLabel)
        return newLabel.data.id
    }

    // get random interval
    // function getRandomInterval(min, max) {
    //     return Math.floor(Math.random() * (max - min + 1) + min)
    // }

    
      //setInterval(getUnreadMessagesandSendReply, getRandomInterval(45, 120) * 1000)
    const main = async function(){
        try{
             setInterval(async ()=>{
             await authorize().then(getUnreadMessagesandSendReply).catch(console.error)
             }, Math.floor(Math.random() * (120 - 45 + 1) + 45)*1000)
        }catch(err){
            console.log(err.message)
        }
         
    }
main()
//authorize().then(main).catch(console.error);