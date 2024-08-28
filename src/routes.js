import { Database } from './database.js'
import { buildRoutePath } from './utils/build-route-path.js'
import { createObjectCsvWriter } from 'csv-writer'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Cria uma instância do banco de dados
const database = new Database()

// Obtém o diretório de Downloads do usuário
const downloadsDir = path.join(os.homedir(), 'Downloads')

// Função para obter a data e hora atual no formato local
const getCurrentDate = () => {
  const date = new Date();
  return date.toLocaleString(); // Retorna a data e hora no formato local
};

export const routes = [
  // Rota para exportar as tarefas para um arquivo CSV
  {
    method: 'GET',
    path: buildRoutePath('/tasks/export'),
    handler: async (request, response) => {
      
      // Seleciona todas as tarefas no banco de dados
      const tasks = database.select('tasks')

      // Se não houver tarefas, retorna um erro 404
      if (!tasks.length) {
        return response
          .writeHead(404)
          .end('Nenhuma tarefa encontrada para exportar.')
      }

      // Define o caminho para salvar o CSV na pasta de Downloads
      const csvFilePath = path.join(downloadsDir, 'tasks.csv')

      // Cria um escritor de CSV com o cabeçalho apropriado
      const csvWriter = createObjectCsvWriter({
        path: csvFilePath,
        header: [
          { id: 'title', title: 'Título' }, // Coluna A
          { id: 'description', title: 'Descrição' } // Coluna B
        ],
        append: false,
        encoding: 'utf8'
      })

      // Mapeia apenas as colunas necessárias
      const simplifiedTasks = tasks.map(task => ({
        title: task.title,
        description: task.description
      }))

      try {
        // Escreve os dados das tarefas no arquivo CSV
        await csvWriter.writeRecords(simplifiedTasks)

        // Define os cabeçalhos da resposta para indicar que o arquivo é para download
        response.setHeader('Content-Disposition', 'attachment; filename="tasks.csv"')
        response.setHeader('Content-Type', 'text/csv; charset=utf-8')

        // Lê o arquivo CSV gerado e envia como resposta para download
        fs.createReadStream(csvFilePath, { encoding: 'utf8' }).pipe(response)
      } catch (error) {
        
        // Trata qualquer erro durante a escrita do arquivo CSV
        return response
          .writeHead(500)
          .end('Erro ao exportar tarefas para CSV.')
      }
    }
  },

  // Rota para obter todas as tarefas
  {
    method: 'GET',
    path: buildRoutePath('/tasks'),
    handler: (request, response) => {
      const { isCompleted } = request.query

      // Seleciona todas as tarefas no banco de dados
      const tasks = database.select('tasks')
      if (isCompleted) {
        
        // Verifica se o parâmetro isCompleted é 'true'
        const completedVerify = isCompleted.toLowerCase()

        if (completedVerify === 'true') {
          // Se for 'true', retorna apenas as tarefas completas
          const completedTasks = database.select('completed')
          return response.end(JSON.stringify(completedTasks))
        }
      }
      // Retorna todas as tarefas
      return response.end(JSON.stringify(tasks))
    }
  },

  // Rota para obter uma tarefa específica pelo ID
  {
    method: 'GET',
    path: buildRoutePath('/tasks/:id'),
    handler: (request, response) => {
      const { isCompleted } = request.query
      const { id } = request.params

      // Verifica se o ID foi fornecido
      if (!id) {
        return response
          .writeHead(400)
          .end('Id não informado.')
      }

      // Seleciona a tarefa com o ID fornecido
      let task = database.select('tasks', { id })

      // Se a tarefa não for encontrada, retorna um erro 404
      if (!task[0]) {
        return response
          .writeHead(404)
          .end('Registro não existente.')
      }

      // Verifica se o parâmetro isCompleted é 'true'
      if (isCompleted) {
        const completedVerify = isCompleted.toLowerCase()
        if (completedVerify === 'true') {
          
          // Se for 'true', retorna a tarefa da lista de tarefas completas
          task = database.select('completed', { id })
        }
      }

      // Retorna a tarefa encontrada
      return response.end(JSON.stringify(task))
    }
  },

  // Rota para criar uma nova tarefa
  {
    method: 'POST',
    path: buildRoutePath('/tasks'),
    handler: (request, response) => {
      const { title, description } = request.body

      // Verifica se title e description foram fornecidos
      if (!title || !description) {
        return response
          .writeHead(400)
          .end('Title ou description não informados.')
      }

      // Cria uma nova tarefa com ID gerado e data/hora atuais
      const newTask = {
        id: randomUUID(),
        title,
        description,
        created_at: getCurrentDate(),
        updated_at: null,
      }

      // Insere a nova tarefa no banco de dados
      database.insert('tasks', newTask)

      // Retorna a nova tarefa criada com status 201
      return response
        .writeHead(201)
        .end(JSON.stringify(newTask))
    }
  },

  // Rota para deletar uma tarefa pelo ID
  {
    method: 'DELETE',
    path: buildRoutePath('/tasks/:id'),
    handler: (request, response) => {
      const { id } = request.params
      const { isCompleted } = request.query

      // Verifica se o ID foi fornecido
      if (!id) {
        return response
          .writeHead(400)
          .end('Id não informado.')
      }

      // Seleciona a tarefa com o ID fornecido
      let task = database.select('tasks', { id })
      if (isCompleted && isCompleted.toLowerCase() === 'true') {
        
        // Se o parâmetro isCompleted for 'true', verifica a lista de tarefas completas
        task = database.select('completed', { id })
      }

      // Se a tarefa não for encontrada, retorna um erro 404
      if (!task[0]) {
        return response
          .writeHead(404)
          .end('Registro não existente.')
      }

      if (isCompleted && isCompleted.toLowerCase() === 'true') {
        
        // Se a tarefa está completa, remove da lista de tarefas completas
        database.delete('completed', id)
      } else {

        // Se não está completa, remove da lista de tarefas
        database.delete('tasks', id)
      }

      // Retorna sucesso com status 204
      return response.writeHead(204).end()
    }
  },

  // Rota para atualizar uma tarefa pelo ID
  {
    method: 'PUT',
    path: buildRoutePath('/tasks/:id'),
    handler: (request, response) => {
      const { id } = request.params
      const { title, description } = request.body

      // Verifica se o ID foi fornecido
      if (!id) {
        return response
          .writeHead(400)
          .end('Id não informado.')
      }

      // Verifica se title e description foram fornecidos
      if (!title || !description) {
        return response
          .writeHead(400)
          .end('Title ou description não informados.')
      }

      // Seleciona a tarefa existente com o ID fornecido
      const oldTask = database.select('tasks', { id })

      // Se a tarefa não for encontrada, retorna um erro 404
      if (!oldTask[0]) {
        return response
          .writeHead(404)
          .end('Registro não existente.')
      }

      // Cria um novo objeto de tarefa com as atualizações e data/hora atuais
      const updatedTask = {
        ...oldTask[0],
        title,
        description,
        updated_at: getCurrentDate(),
      }

      // Atualiza a tarefa no banco de dados
      database.update('tasks', id, updatedTask)

      // Retorna sucesso com status 204
      return response.writeHead(204).end()
    }
  },

  // Rota para marcar uma tarefa como completa
  {
    method: 'PATCH',
    path: buildRoutePath('/tasks/:id/complete'),
    handler: (request, response) => {
      const { id } = request.params

      // Verifica se o ID foi fornecido
      if (!id) {
        return response
          .writeHead(400)
          .end('Id não informado.')
      }

      // Seleciona a tarefa com o ID fornecido
      const task = database.select('tasks', { id })
      const completedTask = database.select('completed', { id })

      // Se a tarefa não for encontrada, retorna um erro 404
      if (!task[0]) {
        return response
          .writeHead(404)
          .end('Registro não existente.')
      }

      // Se a tarefa já está completa, retorna um erro 409
      if (completedTask[0]) {
        return response
          .writeHead(409)
          .end('Task já está completa.')
      }

      // Atualiza a tarefa com a data/hora de conclusão
      task[0].completed_at = getCurrentDate()

      // Move a tarefa para a lista de tarefas completas e remove da lista de tarefas
      database.insert('completed', task[0])
      database.delete('tasks', id)

      // Retorna a tarefa marcada como completa com status 200
      return response
        .writeHead(200)
        .end(JSON.stringify(task[0]))
    }
  }
]