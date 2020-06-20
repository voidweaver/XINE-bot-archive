const fs = require("fs");
const Helper = require("./helper");
const path = require("path");

class Loader {
    constructor(path) {
        this.path = path;
        this.initialized = false;
    }

    init() {
        return new Promise(resolve => {
            fs.readFile(this.path, { encoding: "utf-8" }, (err, json_str) => {
                if (err || json_str == "") this.data = undefined;
                else {
                    this.data = JSON.parse(json_str);
                }
                this.initialized = true;
                resolve();
            });
        });
    }

    get() {
        return this.data;
    }

    make(data) {
        this.set(data);
        return this.get();
    }

    async reload() {
        let json_string = fs.readFileSync(this.path, "utf-8");
        this.data = JSON.parse(json_string);
    }

    save() {
        fs.writeFile(
            this.path,
            Helper.sortedStringify(this.data, undefined, 4),
            { encoding: "utf-8" },
            err => {
                if (err) throw err;
            }
        );
    }

    set(data) {
        if (this.data != data) {
            this.data = data;
            this.save();
        }
        return data;
    }
}

module.exports = {
    SettingsLoader: class SettingsLoader extends Loader {},
    PreferencesLoader: class PreferencesLoader extends Loader {
        constructor(folder_path, guild_id, channel_id) {
            if (guild_id == null) guild_id = "DM";

            let file_path = path.join(folder_path, guild_id, channel_id + ".json");
            super(file_path);
        }

        make(data) {
            fs.mkdir(path.join(this.path, ".."), { recursive: true }, err => {
                if (err) throw err;
                if (
                    !data.user_preferences ||
                    (!data.user_preferences.prefix && data.user_preferences.prefix != "")
                ) {
                    throw new Error("user_preferences.prefix must be specified");
                }
                super.make(data);
            });
        }

        async wipe() {
            fs.unlink(this.path, _ => {
                fs.rmdir(path.dirname(this.path), _ => {});
            });
        }
    },
    ResourceLoader: class ResourceLoader extends Loader {
        constructor(path) {
            super(path);
            this.error_write = new Error("Resources shouldn't be written to!");
        }

        make(data) {
            throw this.error_write;
        }

        save() {
            throw this.error_write;
        }

        set(data) {
            throw this.error_write;
        }
    }
};
