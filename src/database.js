import fs from 'node:fs/promises'

const databasepath = new URL('../db.json', import.meta.url)

export class Database {
  // Propriedade privada para o banco de dados
  #database = {}

  constructor() {
    this.#loadDatabase()
  }

  async #loadDatabase() {
    try {
      const data = await fs.readFile(databasepath, 'utf-8')
      this.#database = JSON.parse(data)
    } catch (error) {
      // Se houver erro (ex.: arquivo não existe), persiste um banco de dados vazio
      await this.#persist()
    }
  }

  async #persist() {
    try {
      await fs.writeFile(databasepath, JSON.stringify(this.#database, null, 2))
    } catch (error) {
      console.error('Erro ao persistir o banco de dados:', error)
    }
  }

  select(table, search) {
    let data = this.#database[table] ?? []

    if (search) {
      data = data.filter(row => {
        return Object.entries(search).some(([key, value]) => {
          return row[key]?.toLowerCase().includes(value.toLowerCase())
        })
      })
    }
    return data
  }

  async insert(table, data) {
    if (Array.isArray(this.#database[table])) {
      this.#database[table].push(data)
    } else {
      this.#database[table] = [data]
    }
    await this.#persist()
    return data
  }

  async update(table, id, data) {
    const rowIndex = this.#database[table]?.findIndex(row => row.id === id)

    if (rowIndex > -1) {
      this.#database[table][rowIndex] = { id, ...data }
      await this.#persist()
    }
  }

  async delete(table, id) {
    const rowIndex = this.#database[table]?.findIndex(row => row.id === id)

    if (rowIndex > -1) {
      this.#database[table].splice(rowIndex, 1)
      await this.#persist()
    }
  }
}
