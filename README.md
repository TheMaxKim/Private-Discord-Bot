Step 1:
Pull the repository and place auth.json in the root

Step 2:
Run the following on a new machine:
```
sudo apt-get update
sudo apt-get install build-essential
sudo apt-get install npm
```

Step 3:
Run
```
npm install
```
in the root directory with package.json

Step 4:
Run the bot by using:
```
node discord.js
```

Step 5:
You may need to run the following if you run into errors:
```
npm install request
sudo npm cache clean -f
sudo npm install -g n
sudo n stable
```
This installs the npm module request and updates node.js to the latest version.

https://github.com/hydrabolt/discord.js/
