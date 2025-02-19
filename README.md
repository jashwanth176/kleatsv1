# Food Ordering Website
KL Eats is a innovative platform designed to streamline campus dining for students and faculty. Our mission is to provide a convenient way to pre-order and book meals from various canteens across our campus. This project was developed with the invaluable support of KL GLUG (GNU/Linux User Group), showcasing the power of open-source collaboration in creating practical solutions for our campus community.


## Build With :
<ul>
    <li><a href="https://www.w3schools.com/html/" target="_blank">HTML</a></li>
    <li><a href="https://www.w3schools.com/css/" target="_blank">CSS</a></li>
    <li><a href="https://www.w3schools.com/js/" target="_blank">JavaScript</a></li>
    <li><a href="https://www.w3schools.com/bootstrap5/index.php" target="_blank">Bootstrap</a></li>
    <li><a href="https://expressjs.com/" target="_blank">ExpressJS</a></li>
</ul>

## Install and Run :
- Clone the repository or download the zip folder.
- Extract the zip folder.
- Install NodeJS in your system.
- Go to the folder where you have extracted or cloned the project.
- Open command prompt or terminal having the same location where your project is.
- Type  npm install  in your command prompt or terminal.

## Dependencies and Setup

### Remove Existing Dependencies
bash
# Remove node_modules directory
rm -rf node_modules
# or delete them manually

# Remove package-lock.json
rm package-lock.json
# or delete it manually


### Install Required Dependencies
bash
# Install all project dependencies
npm install


### Environment Configuration
Create a .env file in your project root with the following configuration:

env
# Server Configuration
PORT=3000

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Email Configuration
ENABLE_EMAIL=false

# Server Configuration
NODE_ENV=development


### Start the Server
bash
# Start the server
npm start
