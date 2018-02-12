#!/usr/bin/env osascript -l JavaScript
/**
 * stop-spamming-me.js
 * @author Sidharth Mishra
 * @description A script for the Mail application to filter out spam-emails using regex. Uses Apple's JavaScript for automation.
 * @created Sat Feb 10 2018 12:23:33 GMT-0800 (PST)
 * @copyright 2018 Sidharth Mishra
 * @last-modified Sun Feb 11 2018 17:33:09 GMT-0800 (PST)
 */
//==============================================================================================

//
// 30 sec preDelay after forcing a check for new emails.
// 15 min postDelay after each run.
//
(function(preDelayTime /** @type {number}*/, postDelayTime /** @type {number}*/) {
  //
  // The current application
  //
  /** @type {any} */
  const App = Application.currentApplication();
  App.includeStandardAdditions = true;

  //
  // Mail app
  //
  const Mail = Application("Mail");
  // const MAIL_ID = Mail.id(); // identifier for the Mail.app
  const isMailRunning = Mail.running(); // flag indicating if Mail.app is running

  //
  // Process of elimination:
  // save a file named `stop-these-spammers.lst`
  // that contains the list of all the regexes needed for filtering
  // out the spam emails.
  //
  // The file contains a regex on each line.
  //
  // Save the file right beside the script application for ease of reading.

  /**
   * Reads the regexes from the file.
   * @param {Path} lstFile The file containing the list of all the regexes.
   * @return {RegExp[]} The list of regexes.
   */
  function getRegexes(lstFile) {
    /**@type {string[]} */
    const strPatterns = App.read(lstFile).split("\n");

    return strPatterns
      .map(pattern => pattern.replace(/#.*/, ""))
      .filter(pattern => pattern && pattern.length > 0)
      .map(pattern => new RegExp(pattern.trim()));
  }

  /**
   * Reads the starters from the file. These will help in filtering out spam emails.
   * @param {Path} lstFile The file containing the list of all starters.
   * @return {string[]} The list of starters.
   */
  function getStarters(lstFile) {
    /**@type {string[]} */
    const strPatterns = App.read(lstFile).split("\n");

    return strPatterns
      .map(pattern => pattern.replace(/#.*/, ""))
      .filter(pattern => pattern && pattern.length > 0)
      .map(pattern => pattern.trim().toLowerCase());
  }

  //
  // Dealing with spams:
  // For each account, if any mail has the sender's email-address matching with any one of the regexes,
  // move the mail from the inbox into junk folder.

  /**
   * Gets the list of all the emails that match the regexes.
   * @param {RegExp[]} regexes The regex filters.
   * @param {string[]} starters The list of starters.
   * @returns {any[]} The list of spam emails.
   */
  function getSpamEmail(regexes, starters) {
    /**
     * Uses the logic that, if the name of the sender is not a substring of the domain part, and the name begins with a list of stuff that you believe to be spam, it is classified as spam.
     * @param {string} senderEmail The sender's email address.
     * @param {string[]} starters The list of starter words to match against for spams.
     * @returns {boolean} true if it is spam else false.
     */
    function isSpamSidObs(senderEmail, starters) {
      /**
       * Checks if there is a substring match recursively.
       * Checks for cases where name is atleast 3 letters long.
       * @param {string} name The name part of the email.
       * @param {string} mail The sender's email.
       * @returns {boolean} true if there was a match else false.
       */
      function isWithin(name, mail) {
        if (!name || name.length < 3) return false;
        return mail.includes(name)
          ? true
          : isWithin(name.substr(0, name.length - 1), mail);
      }

      /**
       * Checks if the word begins with any starter specified.
       * @param {string} word The word to check.
       * @param {string[]} starters The list of user specified starters.
       * @return {boolean} The status of the matches.
       */
      function containsStarters(word, starters) {
        return (
          starters.filter(starter => word.toLowerCase().startsWith(starter)).length > 0
        );
      }

      /**@type {boolean} */
      let flag = false;

      const parts = senderEmail.split(/\s{1}\</).map(part => part.toLowerCase()); // for case ignorance
      const names = parts.length > 1 ? parts[0].split(/\s/) : [];
      const email = parts.length > 1 ? parts[1] : "";

      names.forEach(name => {
        if (flag) return; // no need to check any more
        flag = !isWithin(name, email) && containsStarters(email, starters);
      });

      return flag;
    }

    /**
     * Matches the sender's email address with the RegExp filters.
     * @param {string} senderEmail The sender's email address.
     * @param {RegExp[]} regexes The list of filtering regexes from the regexes.lst file.
     * @returns {boolean} true if there is a match else false.
     */
    function matchesFilter(senderEmail, regexes) {
      /**@type {boolean} */
      let flag = false;

      regexes.forEach(regex => {
        if (flag) return; // not needed anymore
        if (senderEmail.match(regex)) flag = true;
      });

      return flag;
    }

    /**@type {any[]} */
    const spamEmails = [];

    Mail.inbox()
      .mailboxes()
      .forEach(mailbox => {
        mailbox.messages().forEach(msg => {
          if (matchesFilter(msg.sender(), regexes)) spamEmails.push(msg);
          if (isSpamSidObs(msg.sender(), starters)) spamEmails.push(msg);
        });
      });

    return spamEmails;
  }

  /**
   * Moves the spam emails to `Junk` folder of their specific email accounts.
   * Moves by marking the spam emails as JUNK!
   * @param {any[]} spamEmails The spam emails.
   */
  function moveMailToJunk(spamEmails) {
    console.log(`Moving ${spamEmails.length} spam mail(s) to junk!`);

    /** @type {{[name:string]:any}} */
    const junkBoxes = {};
    Mail.junkMailbox()
      .mailboxes()
      .forEach(mailbox => {
        junkBoxes[mailbox.account().name()] = mailbox;
      });

    spamEmails.forEach(mail => {
      mail.junkMailStatus = true;
      mail.mailbox = junkBoxes[mail.mailbox.account().name()]; // move to the corressponding junk mailbox
    });

    console.log(`Moved ${spamEmails.length} spam mail(s) to junk!`);
  }

  //
  // Get the regexes.lst file from the user
  //
  /**@type {Path} */
  const regexesFile = App.chooseFile({
    withPrompt: `Please select the regexes.lst file or .lst file containing the list of filter regular expressions:`
  });

  //
  // Get the starters.lst file from the user
  //
  /**@type {Path} */
  const startersFile = App.chooseFile({
    withPrompt: `Please select the starters.lst file or .lst file containing the list of starter words:`
  });

  /**@type {RegExp[]} */
  const regexes = getRegexes(regexesFile); // "regexes.lst"
  // console.log(`Regexes = ${JSON.stringify(regexes)}`);

  /**@type {string[]} */
  const starters = getStarters(startersFile); // "starters.lst"
  // console.log(`Starters = ${JSON.stringify(starters)}`);

  //
  // For development only
  //
  // const mails = getSpamEmail(regexes, starters);
  // mails.forEach(mail => console.log(`sender mail = ${mail.sender()}`));

  //
  // Keep running till Mail is running. Run the loop every 5 mins.
  //
  while (isMailRunning) {
    try {
      Mail.checkForNewMail(); // force a check for new emails
      delay(preDelayTime);

      moveMailToJunk(getSpamEmail(regexes, starters));

      console.log(`Waiting for ${(postDelayTime / 60) | 0} mins before next run...`);
      delay(postDelayTime);
    } catch (err) {
      console.log(`Error: ${JSON.stringify(err.message())}. Retrying...`);
    }
  }

  console.log(
    `It seems Mail.app is not running. Please run it and then start this script!`
  );
  App.displayDialog(
    `It seems Mail.app is not running. Please run it and then start this script!`
  );
})(30, 15 * 60);
