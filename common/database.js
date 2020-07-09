const sqlite = require('sqlite3').verbose();

class Database {
    #sqliteDb;
    #file;
    #dir;

    state = {
        SUCCESS: 1,
        FAILURE: 2,
        CONSTRAINT_ERROR: 3,
        NOT_FOUND: 4
    };

    constructor(file, dir) {
        this.#file = file;
        this.#dir = dir;
    }
    
    #errorHandling = (err, callback) => {
        if(err != null) {
            if(err.message.includes("SQLITE_CONSTRAINT:")) callback(this.state.CONSTRAINT_ERROR, null);
            else callback({state: this.state.FAILURE, row: null});
        } else {
            return false;
        }
    }

    #buildDb = _ => {
        this.#sqliteDb = new sqlite.Database(`${this.#dir}/${this.#file}.db`, sqlite.OPEN_READWRITE | sqlite.OPEN_CREATE);
    }
    
    insert = (table, fields, values, callback) => {
        try {
            const valuesString = values.map(x => `"${x}"`).join();
            const query = `INSERT INTO ${table} (${fields.join()}) VALUES (${valuesString})`;
            this.#buildDb();
            this.#sqliteDb.run(query, err => {
                if(!this.#errorHandling(err, callback)) {
                    callback({state: this.state.SUCCESS, row: null});
                }
            });
            this.#sqliteDb.close();
        } catch(e) {
            callback({state: this.state.FAILURE, row: null});
        }
    }
    
    select = (table, field, value, callback) => {
        try {
            this.#buildDb();
            this.#sqliteDb.get(`SELECT * FROM ${table} WHERE ${field} = ?`, [value], (err, row) => {
                if(!this.#errorHandling(err, callback)) {
                    if(row == "undefined") callback({state: this.this.state.NOT_FOUND, row: null}) 
                    callback({state: this.state.SUCCESS, row: row})
                }
            });
            this.#sqliteDb.close();
        } catch(e) {
            callback({state: this.state.FAILURE, row: null});
        }
    }

    delete = (table, field, value, callback) => {
        try {
            this.#buildDb();
            this.#sqliteDb.run(`DELETE FROM ${table} WHERE ${field} = ${value}`, err => {
                if(!this.#errorHandling(err, callback)) {
                    callback({state: this.state.SUCCESS, row: null})
                }
            });
            this.#sqliteDb.close();
        } catch(e) {
            callback({state: this.state.FAILURE, row: null});
        }
    }
}

module.exports = Database;