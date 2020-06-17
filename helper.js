module.exports = class Helper {
    static grammarJoin(arr) {
        let result = arr[0];
        for (let i = 1; i < arr.length - 1; i++) {
            result += ", " + arr[i];
        }
        result += " and " + arr[arr.length - 1];
        return result;
    }

    static sortedStringify(obj, ...args) {
        let sorted_obj = {};
        let keys = Object.keys(obj);
        keys.sort();
        for (let key of keys) sorted_obj[key] = obj[key];
        return JSON.stringify(sorted_obj, ...args);
    }

    static dEscape(string) {
        // let result = string.replace(/\\[_*~`>|@#]/g, '\\$&')
        return string.replace(/[\\_*~`>|@#]/g, "\\$&");
    }

    static dPrefix(string) {
        if (string == "") return "none";
        return this.dCode(string);
    }

    static dCode(string) {
        // Add zero-width space after each backtick
        if (string == "") return "` `";
        let result = string.replace(/^`/, "​$&").replace(/`/g, "$&​");
        return `\`\`${result}\`\``;
    }

    static dBlock(string, lang) {
        if (!lang) lang = "";
        let result = string.replace(/(`)(`)/g, "$1​$2"); // Add zero-width space between backticks
        return `\`\`\`${lang}\n${result}\`\`\``;
    }
};
