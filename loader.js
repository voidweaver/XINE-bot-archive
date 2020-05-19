const fs = require('fs')
const Helper = require('./helper')
const path = require('path')

class Loader {
    constructor(path) {
        this.path = path

        if (fs.existsSync(this.path)) {
            let json_string = fs.readFileSync(this.path, 'utf-8')
            if (json_string != '') {
                this.data = JSON.parse(json_string)
            } else {
                console.log('Empty file!')
                this.data = undefined
            }
        } else {
            this.data = undefined
        }
    }

    get() {
        return this.data
    }

    make(data) {
        this.set(data)
        return this.get()
    }

    async reload() {
        let json_string = fs.readFileSync(this.path, 'utf-8')
        this.data = JSON.parse(json_string)
    }

    async save() {
        await fs.writeFileSync(this.path, Helper.sortedStringify(this.data, undefined, 4), 'utf-8', err => {
            if (err) throw err
        })
    }

    set(data) {
        console.log(`data: ${JSON.stringify(data, null, 4)}`)
        console.log(`this.data: ${JSON.stringify(this.data, null, 4)}`)
        if (this.data != data) {
            console.log('data set')
            this.data = data
            this.save()
        }
        return data
    }
}


module.exports = {
    'SettingsLoader': class SettingsLoader extends Loader {},
    'PreferencesLoader': class PreferencesLoader extends Loader {
        constructor(folder_path, channel_id){
            let file_path = path.join(__dirname, folder_path, channel_id + '.json')
            super(file_path)
        }

        make(data) {
            if (!data.user_preferences || (!data.user_preferences.prefix && data.user_preferences.prefix != '')) {
                throw new Error('user_preferences.prefix must be specified')
            }
            super.make(data)
        }
    },
    'ResourceLoader': class ResourceLoader extends Loader {
        constructor(path) {
            super(path)
            this.error_write = new Error('Resources shouldn\'t be written to!')
        }

        make(data) {
            throw this.error_write
        }

        save(){
            throw this.error_write
        }

        set(data) {
            throw this.error_write
        }
    }
}
