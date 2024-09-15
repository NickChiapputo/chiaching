// Import template header and footer HTML.
import {header} from '/header.js'

(() => {
    var userInfo = undefined;
    var loginForm = undefined;
    var registerForm = undefined;
    var newAccountForm = undefined;
    var newTransactionForm = undefined;

    // Transactions List
    var transactions = [];
    var transactionsDiv = undefined;
    var num_transactions_per_page = 10;
    var transaction_start = 0, transaction_end = 0;

    // Transaction Information
    var transaction_tags = [];
    var transaction_locations = [];

    // New Transaction Form
    var newTransactionButton = undefined;
    var showNewTransactionForm = false;
    var showPaycheckSubform = false;
    const newTransactionButtonShowText = "+ Add Transaction";
    const newTransactionButtonHideText = "— Add Transaction";
    var newTranscationSourceAccountSelect = undefined;
    var newTranscationDestinationAccountSelect = undefined;
    var newTransactionIsPaycheckBox = undefined;
    var newTransactionPaycheckSubform = undefined;

    // Accounts List
    var accounts = {};

    // New Accounts
    var newAccountButton = undefined;
    var showNewAccountForm = false;
    const newAccountButtonShowText = "+ Add Account";
    const newAccountButtonHideText = "— Add Account";
    var newAccountSourceAccountSelect = undefined;
    var newAccountDestinationAccountSelect = undefined;

    // New Budget
    var budgetNames = [];
    var newBudgetButton = undefined;
    var showNewBudgetForm = false;
    var newBudgetForm = undefined;
    var newBudgetLineItemButton = undefined;
    var budgetsListDiv = undefined;
    const newBudgetButtonHideText = "+ Add Budget";
    const newBudgetButtonShowText = "— Add Budget";

    document.addEventListener( "DOMContentLoaded", (e) => {
        document.getElementById( "header" ).outerHTML = header;
        // document.getElementById( "footer" ).outerHTML = footer;

        send(
            "/api/user/validateToken", "GET", {},
            (response) => { 
                if( !response.data ) 
                    window.location = `/account/login?redir_url=${window.location}`;
            },
            (err, response, status) => { 
                if( err )
                    console.error( "Check login error!\n" + err ); 
                else
                    console.error( `Check login error! ${status}\n${JSON.stringify(response, null, 2)}` );
            },
            true
        );
        
        modalContainer.addEventListener( "click", (e) => {
            if( e.target == modalContainer ) showModal(false);
        } );
        modalExitButton.addEventListener( "click", e => { showModal(false); } );


        // Transactions
        transactionsDiv = document.getElementById( "transactionsList" );

        newTranscationSourceAccountSelect = document.getElementById( "sourceAccount" );
        newTranscationDestinationAccountSelect = document.getElementById( "destinationAccount" );

        newTransactionForm = document.getElementById( "newTransactionForm" );
        newTransactionForm.addEventListener( "submit", createNewTransaction );
        document.getElementById( "date" ).valueAsDate = new Date();

        newTransactionButton = document.getElementById( "addTransactionButton" );
        newTransactionButton.addEventListener( "click", showNewTransactionModal );

        newTransactionIsPaycheckBox = document.getElementById( "isPaycheck" );
        newTransactionIsPaycheckBox.checked = false;
        newTransactionIsPaycheckBox.addEventListener( "change", toggleIsPaycheck );

        newTransactionPaycheckSubform = document.getElementById( "paycheckGrouping" );

        let currDate = new Date();
        setTransactionsDates( 
            new Date( currDate.getFullYear(), currDate.getMonth(), 1 ),
            new Date( currDate.getFullYear(), currDate.getMonth() + 1, 0 )   
        );

        transactionListStartDate.addEventListener( "change", e => getTransactions() );
        transactionListEndDate.addEventListener( "change", e => getTransactions() );

        transactionTablePagePrevious.addEventListener( "click", e => {
            let previous_page = transactionTablePagePrevious.getAttribute( "previous_page" );
            if( previous_page < 1 ) return;
            updateTransactionPage( previous_page );
        } );
        transactionTablePageNext.addEventListener( "click", e => {
            let next_page = transactionTablePageNext.getAttribute( "next_page" );
            if( next_page < 1 ) return;
            updateTransactionPage( next_page );
        } );


        // Accounts
        newAccountForm = document.getElementById( "newMoneyAccountForm" );
        newAccountForm.addEventListener( "submit", createNewMoneyAccount );

        newAccountButton = document.getElementById( "addAccountButton" );
        newAccountButton.addEventListener( "click", toggleNewMoneyAccountForm );


        // Budgets
        newBudgetForm = document.getElementById( "newBudgetForm" );
        newBudgetForm.addEventListener( "submit", createNewBudget );

        newBudgetButton = document.getElementById( "addBudgetButton" );
        newBudgetButton.addEventListener( "click", toggleNewBudgetForm );

        newBudgetLineItemButton = document.getElementById("addNewBudgetLineItemButton" );
        newBudgetLineItemButton.addEventListener( "click", updateNewBudgetLineItems );

        budgetsListDiv = document.getElementById( "budgetsList" );


        // Populate data
        getMoneyAccounts();
        getTransactions();
        // getBudgets();
    });


    const send = (uri, method, data, successCallback, errorCallback, parseResponse) => {
        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if( this.readyState == 4 && this.status == 200 )
            {
                try { parseResponse ? successCallback( JSON.parse( this.responseText ) ) : successCallback( this.responseText ); }
                catch(e) { errorCallback( e, this.responseText, this.status ); }
            }
            else if( this.readyState == 4 && this.status != 200 )
            {
                try { errorCallback( null, parseResponse ? JSON.parse( this.responseText ) : this.responseText, this.status ) }
                catch(e) { errorCallback( e, this.responseText, this.status ); }
            }
        }

        xhr.open( method, uri );
        if( method == "POST" && data ) xhr.send( JSON.stringify( data ) );
        else xhr.send();
    };


    const getBudgets = () => {
        send( "/api/budget/getNames", "GET", null,
            (resp, status) => {
                clearBudgets();
                budgetNames = resp.budgetNames;
                budgetNames.forEach( getBudget );
            },
            (e, resp, status) => { 
                console.error( e );
                console.log( status, resp ); 
            },
            true
        );
    };


    const getBudget = (budgetName) => {
        let currDate = new Date();
        let query = {
            budgetName: budgetName,
            date: `${currDate.getFullYear()}-${currDate.getMonth()+1}-${currDate.getDate()}`
        };

        send( "/api/budget/get", "POST", query,
            (resp, status) => { displayBudget( resp.budget, resp.transactions ); },
            (e, resp, status) => { 
                console.error( e );
                console.log( status, resp ); 
            },
            true
        );
    };


    const clearBudgets = () => {
        budgetsListDiv.innerHTML = '';
    }


    const displayBudget = (budget, budgetTransactions) => {
        // Create new budget row.
        let budgetRow = document.createElement( "div" );
        budgetRow.classList.toggle( "budgetRow" );


        // Create column for budget data.
        let budgetDataColumn = document.createElement( "table" );
        budgetDataColumn.classList.toggle( "budgetDataColumn" );

        // Add header row to budget data table.
        let budgetDataHeader = document.createElement( "thead" );
        let budgetDataHeaderRow = document.createElement( "tr" );
        const headers = [
            { class: "transactionTableDescription", content: "Category" },
            { class: "transactionTableAmount",      content: "Budget" },
            { class: "transactionTableAmount",      content: "Actual" },
            { class: "transactionTableAmount",      content: "Remaining" },
        ]
        headers.forEach(header => {
            let currHeader = document.createElement( "th" );
            currHeader.innerHTML = header.content;
            currHeader.classList.toggle( header.class )
            budgetDataHeaderRow.appendChild( currHeader );
        });
        budgetDataHeader.appendChild( budgetDataHeaderRow );
        budgetDataColumn.appendChild( budgetDataHeader );

        // Add a tbody to the budget data table.
        let tBody = document.createElement( "tbody" );
        budgetDataColumn.appendChild( tBody );


        // Create column for budget graphics.
        let budgetGraphicsColumn = document.createElement( "div" );
        budgetGraphicsColumn.classList.toggle( "budgetGraphicsColumn" );


        // Add columns to row.
        budgetRow.appendChild( budgetDataColumn );
        budgetRow.appendChild( budgetGraphicsColumn );


        // Populate budget data.
        // Create object with a key for each budget tag.
        let budgetStatus = {};
        let tags = []
        budget.lineItems.forEach((lineItem) => {
            const tag = lineItem.tag;
            const amount = lineItem.amount;
            budgetStatus[ tag ] = {
                currentTotal: 0.0,
                amount: amount,
            };

            tags.push( tag );
        });

        // Sort tags alphabetically, case insensitive.
        tags.sort((a, b) => { 
            return a.localeCompare( b, "en", {"sensitivity" : "base"} ); 
        });


        // Iterate through transactions and calculate sum amount for tags.
        budgetTransactions.forEach( budgetTran => {
            if( budgetStatus[ budgetTran.tag ] )
                budgetStatus[ budgetTran.tag ].currentTotal += budgetTran.amount;
        } );


        // Iterate through each tag and add rows to budget data.
        tags.forEach( tag => {
            const budgetAmount = budgetStatus[ tag ].amount;
            const budgetCurrentTotal = budgetStatus[ tag ].currentTotal;
            const budgetRemaining = budgetAmount - budgetCurrentTotal;


            // Create new line item row.
            let newBudgetEl = document.createElement( "tr" );
            newBudgetEl.classList.toggle( "transaction" );


            // Tag
            let tagCell = document.createElement( "td" );
            tagCell.classList.toggle( "transactionTableDescription" );
            tagCell.innerHTML = tag;
            newBudgetEl.appendChild( tagCell );


            // Add total budget amount, amount spent, and remaining amount cells.
            const cells = [
                { class : "budgetTableBudgetAmount",    value: budgetAmount,        editable: true },
                { class : "budgetTableBudgetSpent",     value: budgetCurrentTotal,  editable: false },
                { class : "budgetTableBudgetRemaining", value: budgetRemaining,     editable: false },
            ];

            cells.forEach( (cell) => {
                let currentCell = document.createElement( "td" );
                currentCell.classList.toggle( cell.class );
                currentCell.classList.toggle( "transactionTableAmount" );
                if( cell.value < 0 ) currentCell.classList.toggle( "currencyAmountNegative" );
                
                let amountStr = numberToCurrencyString( cell.value );

                let currencySignSpan = document.createElement( "span" );
                currencySignSpan.classList.toggle( "currencySymbol" );
                currencySignSpan.innerHTML = amountStr[0];

                let amountSpan = document.createElement( "span" );
                amountSpan.classList.toggle( "currencyValue" );
                amountSpan.innerHTML = amountStr.substring(1);
                if( cell.editable )
                {
                    amountSpan.addEventListener( "dblclick", e => {
                        amountSpan.contentEditable = !amountSpan.isContentEditable;
                    });

                    amountSpan.addEventListener( "keydown", numericInputValidationEventHandler);

                    amountSpan.addEventListener( "focusout", e => {
                        amountSpan.contentEditable = false;

                        // TODO: Update value in budget line with server POST request...
                    } );
                }

                currentCell.appendChild( currencySignSpan );
                currentCell.appendChild( amountSpan );

                newBudgetEl.appendChild( currentCell );
            } );


            // Add transaction row to table.
            tBody.prepend( newBudgetEl );
        });


        // Populate budget graphics.


        // Add row to list.
        budgetsListDiv.appendChild( budgetRow );
    };


    const VALID_NUMERIC_INPUT_KEYS = [
        "Backspace",
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    ];
    const numericInputValidationEventHandler = e => {
        if( !VALID_NUMERIC_INPUT_KEYS.includes( e.key ) ) e.preventDefault();
    };


    const createNewBudget = (e) => {
        console.log( "Creating new budget." );

        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if( this.readyState == 4 && this.status == 200 )
            {
                console.log( "New budget template created!" );
            }
            else if( this.readyState == 4 && this.status != 200 )
            {
                console.log( `Error! HTTP Code: ${this.status}` );
            }
        };

        let data = { lineItems: [] };
        let formData = new FormData( newBudgetForm );
        formData.forEach( (val, key) => {
            // Handle budget items separately. Amount will be taken at the same 
            // time as the tag item, so we can skip it.
            // If not a budget item, add to object normally.
            if( key.endsWith( "Amount" ) ) return;
            if( key.startsWith( "budgetItem" ) )
            {
                data.lineItems.push( {
                    tag:    val,
                    amount: formData.get( `${key}Amount` ),
                } );

                return;
            }

            data[ key ] = val;
        });


        xmlHttp.open( "POST", "/api/budget/new" );
        xmlHttp.send( JSON.stringify( data ) );
        // console.log( data );


        // Don't reload page after submitting.
        e.preventDefault();
        return false;
    };

    const updateNewBudgetLineItems = (e) => {
        // Get list of line items in new budget form.
        // Line item includes tag and amount.
        let tagInputs    = document.getElementsByClassName( "newBudgetLineItemTag" );
        let amountInputs = document.getElementsByClassName( "newBudgetLineItemAmountTag" );

        let numInputs = tagInputs.length;
        let nextID = numInputs + 1;

        // If tag is empty and it and the associated amount field do not have 
        // focus, remove the line item.
        for( let i = 0; i < tagInputs.length; i++ )
        {
            let currTagInput = tagInputs[ i ];
            let currAmountInput = amountInputs[ i ];

            if( currTagInput.value == "" && 
                document.activeElement !== currTagInput && 
                document.activeElement !== currAmountInput )
            {
                nextID = parseInt( currTagInput.getAttribute( "name" ).substring( 10 ) );

                let lineItemParentGrouping = currTagInput.parentNode;
                let amountParentGrouping = currAmountInput.parentNode;

                lineItemParentGrouping.innerHTML = '';
                amountParentGrouping.innerHTML = '';

                lineItemParentGrouping.remove();
                amountParentGrouping.remove();
            }
        }


        // Add new line item at end of list.
        let tagInputParentGrouping = document.createElement( "div" );
        tagInputParentGrouping.classList.toggle( "formInputGroup" );
        
        let tagInput = document.createElement( "input" );
        tagInput.setAttribute( "type", "text" );
        tagInput.setAttribute( "id", `budgetItem${nextID}` );
        tagInput.setAttribute( "name", `budgetItem${nextID}` );
        tagInput.setAttribute( "placeholder", "Tag" );
        tagInput.classList.toggle( "newBudgetLineItemTag" );
        tagInputParentGrouping.appendChild( tagInput );


        let amountInputParentGrouping = document.createElement( "div" );
        amountInputParentGrouping.classList.toggle( "formInputGroup" );
        
        let amountInput = document.createElement( "input" );
        amountInput.setAttribute( "type", "number" );
        amountInput.setAttribute( "id", `budgetItem${nextID}Amount` );
        amountInput.setAttribute( "name", `budgetItem${nextID}Amount` );
        amountInput.setAttribute( "min", "0.00" );
        amountInput.setAttribute( "step", "0.01" );
        amountInput.setAttribute( "value", "0.00" );
        amountInput.classList.toggle( "newBudgetLineItemAmountTag" );
        amountInputParentGrouping.appendChild( amountInput );


        const budgetLineItemGrouping = document.getElementById( "budgetLines" );
        budgetLineItemGrouping.appendChild( tagInputParentGrouping );
        budgetLineItemGrouping.appendChild( amountInputParentGrouping );
    };

    const toggleNewBudgetForm = (e) => {
        showNewBudgetForm = !showNewBudgetForm;

        newBudgetForm.style.display = showNewBudgetForm ? "" : "none";
        newBudgetButton.innerHTML = showNewBudgetForm ? newBudgetButtonShowText : newBudgetButtonHideText;
    };


    const createNewTransaction = (e) => {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if( this.readyState == 4 && this.status == 200 )
            {
                getMoneyAccounts();
                getTransactions();
                // getBudgets();
            }
            else if( this.readyState == 4 && this.status != 200 )
            {
                console.log( `Error! HTTP Code: ${this.status}` );
            }
        };

        let data = {};
        new FormData( newTransactionForm ).forEach( (val, key) => {
            data[ key ] = val;
        });


        // This is "on" if the box is checked. We want it to be a boolean.
        data.isPaycheck = newTransactionIsPaycheckBox.checked


        // Parse selections for source and destination account to
        // check for the institutions.
        data[ "sourceInstitution" ] = data.sourceAccount !== "Outside" ? 
            newTranscationSourceAccountSelect[ newTranscationSourceAccountSelect.selectedIndex ].closest( "optgroup" )?.label :
            "Outside";
        data[ "destinationInstitution"] = data.destinationAccount !== "Outside" ? 
            newTranscationDestinationAccountSelect[ newTranscationDestinationAccountSelect.selectedIndex ].closest( "optgroup" )?.label :
            "Outside";


        xmlHttp.open( "POST", "/api/transactions/new" );
        xmlHttp.send( JSON.stringify( data ) );


        // Don't reload page after submitting.
        e.preventDefault();
        return false;
    }


    const toggleIsPaycheck = (e) => {
        showPaycheckSubform = !showPaycheckSubform;
        newTransactionPaycheckSubform.style.display = showPaycheckSubform ? "" : "none";
    }


    const toggleNewTransactionForm = (e) => {
        if( showNewTransactionForm )
        {
            // Hide form
            newTransactionForm.style.display = "none";
            newTransactionButton.innerHTML = newTransactionButtonShowText;
            showNewTransactionForm = false;
        }
        else
        {
            // Show form
            newTransactionForm.style.display = "";
            newTransactionButton.innerHTML = newTransactionButtonHideText;
            showNewTransactionForm = true;
        }
    };

    const createNewMoneyAccount = (e) => {
        console.log( "Creating new money account." );
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if( this.readyState == 4 && this.status == 200 )
            {
                console.log( "New money account created!" );
            }
            else if( this.readyState == 4 && this.status != 200 )
            {
                console.log( `Error! HTTP Code: ${this.status}` );
            }
        };

        let data = {};
        new FormData( newAccountForm ).forEach( (val, key) => {
            data[ key ] = val;
        });

        xmlHttp.open( "POST", "/api/accounts/new" );
        xmlHttp.send( JSON.stringify( data ) );


        // Don't reload page after submitting.
        e.preventDefault();
        return false;
    }

    const toggleNewMoneyAccountForm = (e) => {
        if( showNewAccountForm )
        {
            // Hide form
            newAccountForm.style.display = "none";
            newAccountButton.innerHTML = newAccountButtonShowText;
            showNewAccountForm = false;
        }
        else
        {
            // Show form
            newAccountForm.style.display = "";
            newAccountButton.innerHTML = newAccountButtonHideText;
            showNewAccountForm = true;
        }
    };


    const setTransactionsDates = (start, end) => {
        let startMonth = ("0" + (start.getMonth() + 1)).slice(-2);
        let startDay = ("0" + start.getDate()).slice(-2);

        let endMonth = ("0" + (end.getMonth() + 1)).slice(-2);
        let endDay = ("0" + end.getDate()).slice(-2);

        transactionListStartDate.value = `${start.getFullYear()}-${startMonth}-${startDay}`;
        transactionListEndDate.value = `${start.getFullYear()}-${endMonth}-${endDay}`;

        transactionListStartDate.valueAsDate = start;
        transactionListEndDate.valueAsDate = end;
    };

    const getTransactions = () => {
        send( "/api/transactions/getWithinDate", "POST", 
            { 
                startDate: transactionListStartDate.value, 
                endDate: transactionListEndDate.value
            },
            (resp, status) => {
                // Sort transactions by descending date (newest first).
                transactions = resp.transactions;
                transactions.sort( (a,b) => {
                    let dateA = a.date;
                    let dateB = b.date;
                    return dateA < dateB ? 1 : dateA > dateB ? -1 : 0;
                } );

                let tag_amounts = {};
                let surplus = 0;
                transactions.forEach(transaction => {
                    if( transaction.sourceInstitution.toLowerCase() === "outside" )
                    {
                        surplus += transaction.amount;
                        if( transaction.tag in tag_amounts ) tag_amounts[ transaction.tag ] += transaction.amount;
                        else tag_amounts[ transaction.tag ] = transaction.amount;
                    }
                    else if( transaction.destinationInstitution.toLowerCase() === "outside" )
                    {
                        surplus -= transaction.amount;
                        if( transaction.tag in tag_amounts ) tag_amounts[ transaction.tag ] -= transaction.amount;
                        else tag_amounts[ transaction.tag ] = -transaction.amount;
                    }
                    else
                    {
                        // Internal transaction
                        // console.log( transaction );
                    }
                });

                console.log( JSON.stringify( tag_amounts, null, 2 ) );
                console.log( `Surplus = ${surplus}` );

                populateTransactions();
            },
            (e, resp, status) => { 
                console.error( e );
                console.log( status, resp ); 
            },
            true
        );

        send( "/api/transactions/getTags", "GET", {},
            (resp, status) => {
                transaction_tags = resp.result;
            },
            (e, resp, status) => {
                console.error( e );
                console.error( e == null ? resp : JSON.stringify( resp, null, 2 ) );
                console.error( status );
            },
            true
        );

        send( "/api/transactions/getLocations", "GET", {},
            (resp, status) => {
                transaction_locations = resp.result;
            },
            (e, resp, status) => {
                console.error( e );
                console.error( e == null ? resp : JSON.stringify( resp, null, 2 ) );
                console.error( status );
            },
            true
        );
    };


    const populateTransactions = (page_num) => {
        transactionsDiv.tBodies[0].innerHTML = '';

        let num_pages = Math.ceil(transactions.length / num_transactions_per_page);
        if( page_num == undefined || page_num < 1 )
            page_num = 1;
        if( page_num > num_pages )
            page_num = num_pages;

        // Place transactions from the current page into the table.
        let start_transaction = num_transactions_per_page * (page_num - 1);
        let end_transaction = Math.min((num_transactions_per_page * page_num), transactions.length);
        transactions.slice( 
            start_transaction,
            end_transaction
        ).forEach(appendTransaction);

        // Display transaction numbers being shown.
        transactionTableNumbers.innerHTML = 
            `Showing ${start_transaction+1}–${end_transaction} of ${transactions.length}`;

        // Create links for the pages.
        // Remove existing links except next and previous
        while( transactionTablePageSelectionContainer.children.length != 2 )
        {
            transactionTablePageSelectionContainer.removeChild( 
                transactionTablePageSelectionContainer.children[ 1 ] 
            );
        }

        // Add new links between next and previous
        // Add event callback
        for( let i = 1; i <= num_pages; i++ )
        {
            let new_page = document.createElement( "span" );
            new_page.classList.toggle( "transactionPage" );
            if( i == page_num )
                new_page.classList.toggle( "currentPage" );
            new_page.innerHTML = i;
            new_page.setAttribute( "page", i );
            new_page.addEventListener( "click", (e) => updateTransactionPage(i) );
            transactionTablePageSelectionContainer.insertBefore( 
                new_page, transactionTablePageNext
            );
        }

        transactionTablePageNext.setAttribute( "next_page", page_num + 1);
        transactionTablePagePrevious.setAttribute( "previous_page", page_num + 1);
    };

    const updateTransactionPage = (page_num) => {
        let num_pages = Math.ceil(transactions.length / num_transactions_per_page);
        if( typeof(page_num) == "string" )
            page_num = parseInt(page_num);
        if( page_num == undefined || page_num < 1 )
            page_num = 1;
        if( page_num > num_pages )
            page_num = num_pages;

        // Update page selectors.
        let children = transactionTablePageSelectionContainer.children;
        for( let i = 1; i < children.length - 1; i++ )
        {
            let child = children[ i ];
            let page = child.getAttribute( "page" );
            if( page == page_num )
            {
                if( !child.classList.contains( "currentPage" ) )
                    child.classList.toggle( "currentPage" );
            } else // page != page_num
            {
                child.classList.remove( "currentPage" );
            }
        }

        if( page_num == num_pages ) transactionTablePageNext.disabled = true;
        else transactionTablePageNext.disabled = false;

        if( page_num == 1 ) transactionTablePagePrevious.disabled = true;
        else transactionTablePagePrevious.disabled = false;

        // Place transactions from the current page into the table.
        transactionsDiv.tBodies[0].innerHTML = '';
        let start_transaction = num_transactions_per_page * (page_num - 1);
        let end_transaction = Math.min((num_transactions_per_page * page_num), transactions.length);
        transactions.slice( 
            start_transaction,
            end_transaction
        ).forEach(appendTransaction);

        // Display transaction numbers being shown.
        transactionTableNumbers.innerHTML = 
            `Showing ${start_transaction+1}–${end_transaction} of ${transactions.length}`;

        
        transactionTablePageNext.setAttribute( "next_page", page_num + 1);
        transactionTablePagePrevious.setAttribute( "previous_page", page_num - 1);
    };

    const createTransactionRow = (transaction) => {
        let srcAccount = transaction.sourceAccount;
        let srcInstitution = transaction.sourceInstitution;

        let destAccount = transaction.destinationAccount;
        let destInstitution = transaction.destinationInstitution;

        let amount = transaction.amount;
        if( destInstitution.toLowerCase() === "outside" )
            amount *= -1;

        let location = transaction.location;

        // Dates are stored as UTC, ignoring times.
        // We need to display the UTC dates to show the correct value.
        let dateObj = new Date( transaction.date );

        let is_mobile = getComputedStyle(document.body).getPropertyValue( "--mobile" ) == "true";
        let year_str = dateObj.getUTCFullYear();
        let month_str_padded = ("00" + (dateObj.getUTCMonth()+1)).slice(-2)
        let month_str = (dateObj.getUTCMonth()+1).toString();
        let day_str_padded = ("00" + dateObj.getUTCDate()).slice(-2)
        let day_str = dateObj.getUTCDate().toString()
        let date = is_mobile ? 
            `${month_str_padded}/${day_str_padded}` : 
            `${year_str}-${month_str_padded}-${day_str_padded}`;

        let description = transaction.description ? transaction.description : "-";

        let tag = transaction.tag;


        // Select
        let selectCell = document.createElement( "td" );
        selectCell.classList.toggle( "transactionTableSelect" );
        selectCell.innerHTML = "";
        let select = document.createElement( "input" );
        select.type = "checkbox";
        selectCell.appendChild( select );


        // Date
        let dateCell = document.createElement( "td" );
        dateCell.classList.toggle( "transactionTableDate" );
        dateCell.innerHTML = date;


        // Description
        let descriptionCell = document.createElement( "td" );
        descriptionCell.classList.toggle( "transactionTableDescription" );
        descriptionCell.innerHTML = description;


        // Location
        let locationCell = document.createElement( "td" );
        locationCell.classList.toggle( "transactionTableLocation" );
        locationCell.innerHTML = location;


        // Account
        let accountCell = document.createElement( "td" );
        accountCell.classList.toggle( "transactionTableAccount" );
        if( srcInstitution.toLowerCase() === "outside" ) // Income
            accountCell.innerHTML = `${destAccount}`;
        else if( destInstitution.toLowerCase() === "outside" ) // Purchase
            accountCell.innerHTML = `${srcAccount}`;
        else // Internal transfer
            accountCell.innerHTML = `${srcAccount} -> ${destAccount}`;


        // Tag
        let tagCell = document.createElement( "td" );
        tagCell.classList.toggle( "transactionTableTag" );
        tagCell.innerHTML = tag;


        // Amount
        let amountCell = document.createElement( "td" );
        amountCell.classList.toggle( "transactionTableAmount" );
        amountCell.classList.toggle( "transactionTableAmountData" );
        if( amount < 0 ) amountCell.classList.toggle( "currencyAmountNegative" );
        amountCell.innerHTML = numberToCurrencyString( amount );


        // Delete
        let deleteCell = document.createElement( "td" );
        deleteCell.classList.toggle( "transactionTableDelete" );
        let delIcon = document.createElement( "img" );
        delIcon.src = "/media/trashcan.svg"
        delIcon.alt = `Delete transaction for ${description}`;
        delIcon.classList.toggle( "transactionTableDeleteIcon" );
        deleteCell.appendChild( delIcon );


        // Create new transaction row.
        let newTransactionEl = document.createElement( "tr" );
        newTransactionEl.classList.toggle( "transaction" );
        newTransactionEl.setAttribute( "_id", transaction._id );

        // Add cells to transaction row.
        newTransactionEl.appendChild( selectCell );
        newTransactionEl.appendChild( dateCell );
        newTransactionEl.appendChild( descriptionCell );
        newTransactionEl.title = description;
        // newTransactionEl.appendChild( locationCell );
        // newTransactionEl.appendChild( accountCell );
        newTransactionEl.appendChild( tagCell );
        newTransactionEl.appendChild( amountCell );
        newTransactionEl.appendChild( deleteCell );

        // Add details view and delete handlers.
        dateCell.addEventListener( "click", showTransactionDetailsModal );
        descriptionCell.addEventListener( "click", showTransactionDetailsModal );
        tagCell.addEventListener( "click", showTransactionDetailsModal );
        amountCell.addEventListener( "click", showTransactionDetailsModal );
        deleteCell.addEventListener( "click", (e) => deleteTransaction(newTransactionEl) );

        return newTransactionEl;
    };

    const appendTransaction = (transaction) => {
        let transaction_row = createTransactionRow(transaction);
        transactionsDiv.tBodies[0].append( transaction_row );
    };

    const prependTransaction = (transaction) => {
        let transaction_row = createTransactionRow(transaction);
        transactionsDiv.tBodies[0].prepend( transaction_row );
    };


    const deleteTransaction = (transactionEl) => {
        console.log( transactionEl )
        send( "/api/transactions/delete", "POST", { "_id": transactionEl.getAttribute( "_id" ) },
            (resp, status) => { getTransactions(); },
            (e, resp, status) => { 
                alert( `Error deleting transaction. ${e}\n\nServer Response: ${status}, ${JSON.stringify(resp, null, 2)}` )
                console.error( e );
                console.log( status, resp ); 
            },
            true
        );
    };


    const showTransactionDetailsModal = (e) => {
        showModal(true);

        // TODO: Populate details
    };


    const showNewTransactionModal = (e) => {
        showModal(true);
    };


    const showModal = (show) => {
        modalContainer.classList.remove( "modalHidden" );
        modal.classList.remove( "modalHidden" );
        modalContainer.classList.remove( "modalShow" );
        modal.classList.remove( "modalShow" );

        if( show )
        {  // Show modal
            modalContainer.classList.add( "modalShow" );
            modal.classList.add( "modalShow" );
        }
        else
        { // Hide modal
            modalContainer.classList.add( "modalHidden" );
            modal.classList.add( "modalHidden" );
        }


        // On Firefox, the calendar icon will show through any
        // elements on top of the date input.
        transactionListStartDate.disabled = show;
        transactionListEndDate.disabled = show;
    }


    const sendCreateMoneyAccountRequest = (e) => {
        console.log( "Creating new money account." );
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if( this.readyState == 4 && this.status == 200 )
            {
                console.log( "Money account created!" );
            }
            else if( this.readyState == 4 && this.status != 200 )
            {
                console.log( `Error! HTTP Code: ${this.status}` );
            }
        };

        let data = {};
        new FormData( newMoneyAccountForm ).forEach( (val, key) => {
            data[ key ] = val;
        });


        xmlHttp.open( "POST", "/api/accounts/new" );
        xmlHttp.send( JSON.stringify( data ) );


        // Don't reload page after submitting.
        e.preventDefault();
        return false;
    };


    const sendLoginRequest = ( e ) => {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if( this.readyState == 4 && this.status == 200 )
            {
                console.log( "Logged in!" );
            }
            else if( this.readyState == 4 && this.status != 200 )
            {
                console.log( `Error! HTTP Code: ${this.status}` );
            }
        };

        let data = {};
        new FormData( loginForm ).forEach( (val, key) => {
            data[ key ] = val;
        });


        xmlHttp.open( "POST", "/api/user/login" );
        xmlHttp.send( JSON.stringify( data ) );


        // Don't reload page after submitting.
        e.preventDefault();
        return false;
    };


    const sendCreateUserAccountRequest = ( e ) => {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if( this.readyState == 4 && this.status == 200 )
            {
                console.log( `Good response!` );

                let response = JSON.parse( this.responseText );
                console.log( `Response:\n${JSON.stringify( response, null, 4 )}` );

                alert( `Account created!` );
            }
            else if( this.readyState == 4 && this.status != 200 )
            {
                console.log( `Error! HTTP Code: ${this.status}` );

                try
                {
                    let response = JSON.parse( this.responseText );
                    console.log( `Response:\n${JSON.stringify( response, null, 4 )}` );
                    alert( response.response.msg );
                }
                catch (e)
                {
                    console.log( this.responseText );
                    alert( this.responseText );
                }

                // document.getElementById( "serverResponse" ).innerHTML = `${response.result}`;
                // document.getElementById( "serverResponse" ).style.display = "";
            }
        };

        let data = {};
        new FormData( newAccountForm ).forEach( (val, key) => {
            data[ key ] = val;
        });


        xmlHttp.open( "POST", "/api/user/new" );
        xmlHttp.send( JSON.stringify( data ) );


        // Don't reload page after submitting.
        e.preventDefault();
        return false;
    };


    const getMoneyAccounts = () => {
        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if( this.readyState == 4 && this.status == 200 )
            {
                let response = {};
                try
                {
                    response = JSON.parse( this.responseText );
                    populateAccounts( response.accounts );
                    populateTransactionAccounts();
                }
                catch( e )
                {
                    console.log( `Error handling get accounts response:\n${this.responseText}\n${e}` );
                    return;
                }
            }
            else if( this.readyState == 4 && this.status != 200 )
            {
                console.log( `Error! HTTP Code: ${this.status}.` );

                let response = {};
                try
                {
                    response = JSON.parse( this.responseText );
                }
                catch( e )
                {
                }
            }
        }

        xhr.open( "GET", "/api/accounts/get" );
        xhr.send();
    };


    const numberToCurrencyString = (n) => { 
        let str = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        if( n < 0 )
            str = '(' + str + ')';
        str = '$' + str;
        return str;
    }


    const populateAccounts = (accountList) => {
        accounts = {}; // Reset accounts list.

        // Group accounts by institution.
        accountList.forEach( (a) => {
            let institution = a.institution ? a.institution : "No Institution";
            if( !accounts[ institution ] )
                accounts[ institution ] = [ a ];
            else
                accounts[ institution ].push( a );
        });

        let allAccountsSum = 0.00;

        // Populate page with accounts grouped by institution.
        const accountsListDiv = document.getElementById( "accountsList" );
        accountsListDiv.innerHTML = ''; // Reset accounts list.
        for( const institution in accounts )
        {
            accounts[ institution ].sort();
            const newInstitution = accounts[ institution ];
            const newInstitutionDiv = document.createElement( "div" );
            newInstitutionDiv.classList.toggle( "accountsListInstitution" );
            newInstitution.id = institution;

            let header = document.createElement( "div" );
            header.classList.toggle( "sectionSubtitle" );
            header.innerHTML = institution;
            newInstitutionDiv.appendChild( header );


            newInstitution.forEach( (account) => {
                // Account Information Container
                let accountInfoEl = document.createElement( "div" );
                accountInfoEl.classList.toggle( "accountsListAccount" );


                // Account Name
                let accountNameEl = document.createElement( "div" );
                accountNameEl.classList.toggle( "accountsListAccountName" );
                accountNameEl.innerHTML = account.name;


                // Account Balance
                let accountBalanceEl = document.createElement( "div" );
                accountBalanceEl.classList.toggle( "accountsListAccountBalance" );

                let amountStr = numberToCurrencyString( account.balance );
                if( account.balance < 0 ) accountBalanceEl.classList.toggle( "currencyAmountNegative" );
                
                let currencySignSpan = document.createElement( "span" );
                currencySignSpan.classList.toggle( "currencySymbol" );
                currencySignSpan.innerHTML = amountStr[0];
                
                let amountSpan = document.createElement( "span" );
                amountSpan.classList.toggle( "currencyValue" );
                amountSpan.innerHTML = amountStr.substring(1);

                accountBalanceEl.appendChild( currencySignSpan );
                accountBalanceEl.appendChild( amountSpan );


                // Add account information to account container.
                accountInfoEl.appendChild( accountNameEl );
                accountInfoEl.appendChild( accountBalanceEl );


                // Add to institution container.
                newInstitutionDiv.appendChild( accountInfoEl );


                allAccountsSum += account.balance;
            });


            accountsListDiv.appendChild( newInstitutionDiv );
        }


        // Set total balance.
        // TODO: Split into different types of accounts.
        document.getElementById( "totalValueSpan" ).innerHTML = numberToCurrencyString( allAccountsSum ).substring(1);
    }


    const populateTransactionAccounts = () => {
        let institutions = [];
        let k;
        for( k in accounts )
        {
            if( accounts.hasOwnProperty(k) ) institutions.push( k );
        }

        institutions.sort();


        // Create a default "Outside" account selection.
        let outsideOption = document.createElement( "option" );
        outsideOption.innerHTML = "Outside";
        outsideOption.value = "Outside";

        newTranscationSourceAccountSelect.appendChild( outsideOption );
        newTranscationDestinationAccountSelect.appendChild( outsideOption.cloneNode(true) );


        institutions.forEach( (institution) => {
            let institutionOptGroup = document.createElement( "optgroup" );
            institutionOptGroup.label = institution;

            accounts[ institution ].forEach( (account) => {
                let accountOption = document.createElement( "option" );
                accountOption.innerHTML = account.name;
                accountOption.value = account.name;
                institutionOptGroup.appendChild( accountOption );
            });

            newTranscationSourceAccountSelect.appendChild( institutionOptGroup );
            newTranscationDestinationAccountSelect.appendChild( institutionOptGroup.cloneNode(true) );
        });
    }


    var handleLoggedInUser = () => {
        // Remove "Register Now!" button.
        console.log( "Removing register button." );
        document.getElementById( "registerButton" ).remove();

        // Create span for display name.
        let displayNameField = document.createElement( "span" );
        displayNameField.innerHTML = userInfo.displayName;
        document.getElementById( "titleRight" ).appendChild( displayNameField );


        // TODO: Add profile button on header and populate with information.


        // Check if admin user.
        // If so, add admin bar.
        if( userInfo.roles.includes( "admin" ) )
        {
            console.log( "user is admin" );
            let menuBar = document.getElementById( "menubar" );

            // Nav item container
            let adminDashboardNavItem = document.createElement( "div" );
            adminDashboardNavItem.classList.add( "navItem" );
            adminDashboardNavItem.classList.add( "admin" );

            // Reference link
            let adminRefLink = document.createElement( "a" );
            adminRefLink.href = "/admin";
            adminRefLink.innerHTML = "admin";
            
            // Add link to nav item.
            adminDashboardNavItem.appendChild( adminRefLink );

            // Add admin dashboard item to front of menu options.
            menuBar.appendChild( adminDashboardNavItem );
        }
    };
})();