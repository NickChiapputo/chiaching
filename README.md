# <div><img src="https://github.com/user-attachments/assets/855577d8-9890-4d12-aaa3-cd9da6655d7f" data-canonical-src="https://github.com/user-attachments/assets/855577d8-9890-4d12-aaa3-cd9da6655d7f" height="30" /> ChiaChing</div>


## Setup
### Initial Server Setup
* `sudo apt-get install nginx`
* `sudo ufw allow 'Nginx HTTP'`
* `sudo ufw allow OpenSSH`
* `sudo ufw enable`
* https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu-22-04
* https://www.digitalocean.com/community/tutorials/how-to-install-linux-nginx-mysql-php-lemp-stack-on-ubuntu-22-04#step-4-configuring-nginx-to-use-the-php-processor
### Creating Server Files
* `sudo mkdir /var/www/<website_url>`
* `sudo chown -R $USER:$USER /bar/www/<website_url>`
* `git clone git@github.com:NickChiapputo/chiaching /var/www/<website_url>`
### Nginx Setup
* Follow the reference link to install and configure nginx first and then follow the below commands to set the server configurations.
* `sudo ln -s /var/www/<website_url>/nginx-setup/<website_url> /etc/nginx/sites-enabled/<website_url>`
* `sudo ln -s /etc/nginx/sites-enabled/<website_url> /etc/nginx/sites-available/<website_url>`
* `sudo unlink /etc/nginx/sites-enabled/default`
* `sudo nginx -t`
* `sudo systemctl reload nginx`
* https://www.digitalocean.com/community/tutorials/how-to-install-linux-nginx-mysql-php-lemp-stack-on-ubuntu-22-04#step-4-configuring-nginx-to-use-the-php-processor
### NodeJS-PM2 Setup
* `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash`
* `source ~/.bashrc`
* Get a list of available NodeJS versions to install with `nvm list-remote`
* Select the latest LTS release and install. Example: `nvm install v16.16.0`
* `sudo apt install npm`
* `sudo npm update -g`
* `npm set prefix '~/.npm-packages'`
* Append to ~/.bashrc: `export PATH="$PATH:$HOME/.npm-packages/bin`
* `npm i -g pm2`
* Navigate to `/var/www/<website_url>/node/` before installing the following npm modules.
* `npm i mongodb`
* `npm i bcrypt`
* `npm i jsonwebtoken`
* Anytime you need to work with pm2 in a new terminal session, run `nvm use node` first.
* In `/var/www/<website_url>/node/`, run `pm2 start index.js --name <optional_service_name>` to create the pm2 process.
* `pm2 monit` or `pm2 log` to watch live logs. `pm2 reload` to reload changes to the script.
* `pm2 save` *should* save the state of the pm2 processes and persist through restarts. Doesn't always work, in that case we need `pm2 resurrect`.
* https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-22-04
* https://www.digitalocean.com/community/tutorials/nodejs-pm2
* https://stackoverflow.com/questions/19352976/npm-modules-wont-install-globally-without-sudo
* To have PM2 auto-start and reload the saved configuration, run `pm2 startup` and run the provided command. PM2 will then reload the script everytime on boot.
### SSL Certificates for HTTPS
* `sudo snap install core; sudo snap refresh core`
* `sudo apt remove certbot`
* `sudo snap install --classic certbot`
* `sudo ln -s /snap/bin/certbot /usr/bin/certbot`
* `sudo ufw allow 'Nginx Full'`
* `sudo ufw delete allow 'Nginx HTTP'`
* `sudo certbot --nginx -d <website_url> -d www.<website_url>`
* Add the subdomain (e.g., `finances` for `<website_url>`) for other subdomains as necessary.
* If more subdomains are needed afterwards, use the following and include every subdomain you want the certificate to cover in the format of `<subdomain>.<website_url>`.
    * `sudo certbot --expand -d <website_url>,www.<website_url>,<subdomain>.<website_url>`
* https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-22-04
### MongoDB
#### Install MongoDB
* `wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -`
    * This is for version 6.0. You should check the current version before using the above command.
* `echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list`
* `sudo apt-get update`
* If current MongoDB hasn't been updated for current distro version, may need to install old dependencies (not secure, but I did it anyway). For example: https://askubuntu.com/questions/1403619/mongodb-install-fails-on-ubuntu-22-04-depends-on-libssl1-1-but-it-is-not-insta
* `sudo apt-get install mongodb-org`
* `sudo systemctl start mongod`
* `sudo systemctl enable mongod`
* https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/
#### Secure MongoDB
```
> use admin
> db.createUser( { user: "<username>", pwd: passwordPrompt(), roles: [ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" ] } )
```
* Uncomment `security` in /etc/mongod.conf and add `authorization: enabled` beneath it.
* Source: https://www.digitalocean.com/community/tutorials/how-to-secure-mongodb-on-ubuntu-20-04
#### Collections
* **users**
    * Collection of user documents.
    * Each document has:
        * `username`
            * Unique, case insensitive
        * `email`
            * Unique, case insensitive
        * `first`
            * First name
        * `last`
            * Last name
        * `transactions`
            * Array of all user transactions.
            * Each transaction has the following:
                * `amount`
                * `date`
                * `destinationAccount`
                * `destinationInstitution`
                * `location`
                * `notes`
                * `sourceAccount`
                * `sourceInstitution`
                * `tag`
            * If the source or the destination is "outside", both account and institution are set to "outside".
    * Indexes
        * Unique username, email, display name (case insensitive)
        * `db.users.createIndex( { username: 1 }, { name: "username", unique: true, collation: { locale: "en", strength: 2, caseLevel: false } } )`
        * `db.users.createIndex( { email: 1 }, { name: "email", unique: true, collation: { locale: "en", strength: 2, caseLevel: false } } )`
        * `db.users.createIndex( { displayName: 1 }, { name: "displayName", unique: true, collation: { locale: "en", strength: 2, caseLevel: false } } )`
* **accounts**
    * Collection of money accounts for specified user.
    * Each document has:
        * `username`
            * Username associated with the account
        * `name`
            * User-specified name for the account
        * `institution`
            * Financial institution (e.g., bank name, broker) the account is a member of.
    * Indexes
        * Unique combination of username, name, and institution (case insensitive).
        * `db.accounts.createIndex( { username: 1, name: 1, institution: 1 }, { name: "uniqueAccount", unique: true, collation: { locale: "en", strength: 2, caseLevel: false } } )`
* **budgetTemplates**
    * Collection of budget templates for specified user.
    * Each document has:
        * `username`
            * Username associated with the budget.
        * `budgetName`
            * User-defined name of the budget.
        * `lineItems`
            * List of tags and default budget amounts.
        * `recurrence`
            * Frequency of the budget. Current valid options are:
                * `monthly`
        * `instances`
            * List of individual instances created when a budget is requested for a specified period.
            * Each instance covers a period as defined by `recurrence`.
            * Each object has:
                * `startDate`
                * `endDate`
                * `lineItems`
    * Indexes
        * Unique combination of username and budgetName (case insensitive).
        * `db.budgetTemplates.createIndex( { username: 1, budgetName: 1 }, { name: "uniqueBudgetTemplate", unique: true, collation: { locale: "en", strength: 2, caseLevel: false } } )`
* **budgets**
    * Collection of budget instances for specified user.
    * This is separated from the budget templates to allow use of MongoDB querying to search for a budget instance that covers a specific date.
    * Each document has:
        * `username`
            * Username associated with the budget.
        * `budgetName`
            * User-defined name of the budget. Must match the template budgetName.
        * `startDate`
            * Starting date of the budget instance (inclusive). Example: For recurrence of monthly, this will be the first day of the month.
        * `endDate`
            * End date of the budget instance (inclusive). Example: For recurrence of monthly, this will be the last day of the month.
        * `lineItems`
            * List of tags and budget amounts. Amounts are user-editable for the specific instance to allow for differing budgets period-to-period.
    * Dates are stored as UTC strings at midnight. Comparisons should only be made on the dates (year/month/date) after converting the JS Date object to UTC time.
        * `let date = new Date();`
        * `date = new Date( Date.UTC( date.getFullYear(), date.getMonth(), date.getDate() ) );`
    * Indexes
        * Unique combination of username, budgetName, startDate, and endDate (case insensitive).
        * `db.budgets.createIndex( { username: 1, budgetName: 1, startDate: 1, endDate: 1 }, { name: "uniqueBudgetInstance", unique: true, collation: { locale: "en", strength: 2, caseLevel: false } } )`
* **transactions**
    * Collection of transactions for specified user.
    * This is separated from the user to allow for easier searching than on a nested array.
    * Each document has:
        * `amount`
        * `date`
        * `destinationAccount`
        * `destinationInstitution`
        * `location`
        * `notes`
        * `sourceAccount`
        * `sourceInstitution`
        * `tag`
* **sessions**: 
    * Indexes
        * Expires after `expiresAt` date
        * `db.session.createIndex( { "expiresAt": 1 }, { expireAfterSeconds: 0 } )`
#### Backing Up and Restoring MongoDB Databases
* https://www.mongodb.com/basics/backup-and-restore
