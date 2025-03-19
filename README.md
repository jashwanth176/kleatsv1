# Food Ordering Website
KL Eats is a innovative platform designed to streamline campus dining for students and faculty. Our mission is to provide a convenient way to pre-order and book meals from various canteens across our campus. This project was developed with the invaluable support of KL GLUG (GNU/Linux User Group), showcasing the power of open-source collaboration in creating practical solutions for our campus community.


## Build With :
<ul>
    <li><a href="https://www.w3schools.com/html/" target="_blank">HTML</a></li>
    <li><a href="https://www.w3schools.com/css/" target="_blank">CSS</a></li>
    <li><a href="https://www.w3schools.com/js/" target="_blank">JavaScript</a></li>
    <li><a href="https://www.w3schools.com/bootstrap5/index.php" target="_blank">Bootstrap</a></li>
    <li><a href="https://expressjs.com/" target="_blank">ExpressJS</a></li>
    <li><a href="https://www.w3schools.com/mysql/default.asp" target="_blank">MySQL</a></li>
</ul>

## Install and Run :
- Clone the repository or download the zip folder.
- Extract the zip folder.
- Install NodeJS in your system.
- Go to the folder where you have extracted or cloned the project.
- Open command prompt or terminal having the same location where your project is.
- Type ``` npm install ``` in your command prompt or terminal.
- Now to run the project on your server type ``` npm start ``` .





---------------------------------------------------------------------------------------------------------------------------------------------------------------------



Remove Existing Dependencies

rm -rf node_modules
rm package-lock.json


Install Dependencies

npm install

npm install dotenv express body-parser cookie-parser ejs express-fileupload uuid mysql2 nodemailer crypto @supabase/supabase-js path express-session https fs http qrcode axios bcrypt web-push firebase-admin helmet


Install Global Dependencies

npm install -g semver

-------------------------------------------------------


Environment Configuration


PORT=3000
SUPABASE_URL=https://gvsmghoqhfbvywirxqgy.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c21naG9xaGZidnl3aXJ4cWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MDYxMzAsImV4cCI6MjA1MTI4MjEzMH0.8cq-vZa17qm1jivswhZD056CumFkuA8C9PrrgOhzx3I

# Web Push configuration
VAPID_PUBLIC_KEY=BOdEBePVOnnFIkfeW1rHytnZrkEuu9gqgDggWXoTLsuZXdpePs7pd11bofVjHSEsYecX6jaZ5Unm5THOvxnKHPQ
VAPID_PRIVATE_KEY=sRsA4gz1TBDgl-OucZb4u4rOyf14-BROIaK1D9Vy8bQ

# Temporarily disable email configuration for testing
ENABLE_EMAIL=false







-------------------------------------------------------
app.js


Configure Web Push

const webpush = require('web-push');

const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
};

webpush.setVapidDetails(
    'mailto:your-email@example.com', // Replace with your email
    vapidKeys.publicKey,
    vapidKeys.privateKey
);




HTTPS Redirection

const httpApp = express();
httpApp.use((req, res) => {
    res.redirect(`https://${req.headers.host}${req.url}`);
});

http.createServer(httpApp).listen(80, () => {
    console.log('HTTP Server running on port 80');
});

const port = process.env.PORT || 3000;
const httpServer = http.createServer(app);
httpServer.listen(port, () => {
    console.log(`HTTP Server running on port ${port}`);
});
