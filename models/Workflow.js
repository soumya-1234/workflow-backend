const mongoose = require('mongoose');

const nodeSchema = new mongoose.Schema({
  id: String,
  type: String,
  position: {
    x: Number,
    y: Number,
  },
  data: {
    label: String,
    fields: [{
      label: String,
      value: String,
    }],
  },
});

const edgeSchema = new mongoose.Schema({
  id: String,
  source: String,
  target: String,
});

const workflowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  workflowId: {
    type: String,
    required: true,
    unique: true,
    default: () => Math.random().toString(36).substr(2, 9),
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'passed', 'failed'],
    default: 'pending'
  },
  error: {
    type: String,
    default: null,
  },
  nodes: [nodeSchema],
  edges: [edgeSchema],
  createdOn: {
    type: Date,
    default: Date.now,
  },
  lastEditedOn: {
    type: Date,
    default: Date.now,
  },
  lastExecutedOn: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('Workflow', workflowSchema);
