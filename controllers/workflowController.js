const Workflow = require('../models/Workflow');
const nodemailer = require('nodemailer');
const axios = require('axios');

// Get all workflows with search functionality
exports.getWorkflows = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { workflowId: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const workflows = await Workflow.find(query)
      .sort({ lastEditedOn: -1 });

    res.json(workflows);
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ message: 'Error fetching workflows', error: error.message });
  }
};

// Create new workflow
exports.createWorkflow = async (req, res) => {
  try {
    const { name, description, nodes, edges } = req.body;
    const workflowId = '#' + Math.floor(1000 + Math.random() * 9000);

    const workflow = new Workflow({
      name,
      workflowId,
      description,
      nodes,
      edges,
      status: 'pending'
    });

    await workflow.save();
    res.status(201).json(workflow);
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ message: 'Error creating workflow', error: error.message });
  }
};

// Execute workflow
exports.executeWorkflow = async (req, res) => {
  const { workflowId } = req.params;
  
  try {
    const workflow = await Workflow.findOne({ workflowId });
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    // Update workflow status to running
    workflow.status = 'running';
    workflow.lastExecutedOn = new Date();
    await workflow.save();

    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Execute each node in sequence
    for (const node of workflow.nodes) {
      if (node.type === 'custom') {
        const nodeData = node.data;

        if (nodeData.nodeType === 'api') {
          const endpoint = nodeData.fields.find(f => f.label === 'Endpoint')?.value;
          const method = nodeData.fields.find(f => f.label === 'Method')?.value;
          const headers = JSON.parse(nodeData.fields.find(f => f.label === 'Headers')?.value || '{}');
          const body = JSON.parse(nodeData.fields.find(f => f.label === 'Body')?.value || '{}');

          try {
            const response = await axios({
              method: method?.toLowerCase() || 'get',
              url: endpoint,
              headers,
              data: body
            });

            // Store API response in node data
            node.data.response = response.data;
          } catch (error) {
            workflow.status = 'failed';
            workflow.error = `API Error: ${error.message}`;
            await workflow.save();
            return res.status(500).json({ message: 'Workflow execution failed', error: error.message });
          }
        }

        if (nodeData.nodeType === 'email') {
          const to = nodeData.fields.find(f => f.label === 'To')?.value;
          const subject = nodeData.fields.find(f => f.label === 'Subject')?.value;
          const body = nodeData.fields.find(f => f.label === 'Body')?.value;

          try {
            await transporter.sendMail({
              from: process.env.SMTP_FROM,
              to,
              subject,
              text: body
            });
          } catch (error) {
            workflow.status = 'failed';
            workflow.error = `Email Error: ${error.message}`;
            await workflow.save();
            return res.status(500).json({ message: 'Workflow execution failed', error: error.message });
          }
        }
      }
    }

    // Update workflow status to completed
    workflow.status = 'passed';
    workflow.error = null;
    await workflow.save();

    res.json({ message: 'Workflow executed successfully', workflow });
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({ message: 'Error executing workflow', error: error.message });
  }
};
