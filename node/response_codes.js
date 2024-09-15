/*
REPONSE CODES
    These response codes are used for parsing on client-side.
    Only response code 0 should correlate to an HTTP 200 OK response.  
*/
const RESPONSE_CODES = {
    "OK" :                  { "code" :  0, "msg" : "OK" },
    "UnknownCommand" :      { "code" :  1, "msg" : "Unknown command." },
    "MissingData" :         { "code" :  2, "msg" : "Missing Data." },
    "BadAPICommand":        { "code" :  3, "msg" : "Invalid API command." },
    "AlreadyLoggedIn":      { "code" :  4, "msg" : "User is already logged in." },
    "RedirectToLogin":      { "code" :  5, "msg" : "Redirect user to login." },
    "DatabaseError":        { "code" :  6, "msg" : "Database error." },
    "UserDoesNotExist":     { "code" :  7, "msg" : "User does not exist." },
    "InvalidToken":         { "code" :  8, "msg" : "User is not logged in." },
    "BadSignIn":            { "code" :  9, "msg" : "Invalid sign-in credentials." },
    "TokenError":           { "code" : 10, "msg" : "Error generating login token." },
    "SuccessfulLogIn":      { "code" : 11, "msg" : "Successfully logged in." },
    "InvalidFormData":      { "code" : 12, "msg" : "Invalid form data." },
    "ItemExists":           { "code" : 13, "msg" : "Item exists in database." },
    "AccountCreated":       { "code" : 14, "msg" : "Account successfully created." },
    "OAuthError" :          { "code" : 15, "msg" : "Error contacting OAuth server." },
    "BadMethodGET":         { "code" : 16, "msg" : "Incorrect method. Must be GET!" },
    "BadMethodPOST":        { "code" : 17, "msg" : "Incorrect method. Must be POST!" },
    "BudgetDoesNotExist":   { "code" : 18, "msg" : "Budget name does not exist." },
};

module.exports = {
    RESPONSE_CODES
};
