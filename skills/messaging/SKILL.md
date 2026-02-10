---
name: messaging
description: Send messages between agents using SendMessage including direct messages, broadcasts, shutdown requests/responses, and plan approvals. Use when communicating between agents, understanding message formats, or handling structured protocol messages.
---

# Messaging

Send and receive messages between agents. All inter-agent communication flows through the messaging system.

**Related skills:**
- [Orchestrating](../orchestrating/SKILL.md) - Primitives overview and quick reference
- [Team Management](../team-management/SKILL.md) - Shutdown and plan approval workflows
- [Task System](../task-system/SKILL.md) - Coordinating task progress
- [Error Handling](../error-handling/SKILL.md) - Debugging message issues

---

## SendMessage Tool

All messaging uses the `SendMessage` tool with different `type` values.

### Direct Message (type: "message")

Send a message to **one specific teammate**:

```javascript
SendMessage({
  type: "message",
  recipient: "security-reviewer",
  content: "Please prioritize the authentication module. The deadline is tomorrow.",
  summary: "Prioritize auth module review"  // 5-10 word preview shown in UI
})
```

**Parameters:**
- `type` - `"message"` (required)
- `recipient` - Teammate name (required)
- `content` - Message text (required)
- `summary` - Brief preview for UI (required)

**IMPORTANT for teammates:** Your plain text output is NOT visible to the team. You MUST use `SendMessage` to communicate. Just typing a response is not enough.

### Broadcast (type: "broadcast")

Send the **same message to all teammates** at once:

```javascript
SendMessage({
  type: "broadcast",
  content: "Status check: Please report your progress",
  summary: "Requesting status from all teammates"
})
```

**Parameters:**
- `type` - `"broadcast"` (required)
- `content` - Message text (required)
- `summary` - Brief preview for UI (required)

**WARNING:** Broadcasting is expensive. Each broadcast sends N separate messages for N teammates. Costs scale linearly with team size.

**When to broadcast:**
- Critical issues requiring immediate team-wide attention
- Major announcements that affect everyone equally

**When NOT to broadcast (use direct message instead):**
- Responding to one teammate
- Normal back-and-forth communication
- Information relevant to only some teammates
- Following up on a task with one person

### Shutdown Request (type: "shutdown_request")

Ask a teammate to gracefully exit:

```javascript
SendMessage({
  type: "shutdown_request",
  recipient: "security-reviewer",
  content: "All tasks complete, wrapping up"
})
```

### Shutdown Response (type: "shutdown_response")

When you receive a shutdown request, you **MUST** respond:

**Approve (exits your process):**
```javascript
SendMessage({
  type: "shutdown_response",
  request_id: "shutdown-abc123",  // From the shutdown_request message
  approve: true
})
```

**Reject (continue working):**
```javascript
SendMessage({
  type: "shutdown_response",
  request_id: "shutdown-abc123",
  approve: false,
  content: "Still working on task #3, need 5 more minutes"
})
```

**IMPORTANT:** Extract the `requestId` from the received shutdown request JSON and pass it as `request_id`. Simply saying "I'll shut down" is NOT enough - you must call the tool.

### Plan Approval Response (type: "plan_approval_response")

When a teammate with `plan_mode_required` sends a plan approval request:

**Approve:**
```javascript
SendMessage({
  type: "plan_approval_response",
  request_id: "plan-xyz789",   // From the plan_approval_request message
  recipient: "architect",
  approve: true
})
```

**Reject with feedback:**
```javascript
SendMessage({
  type: "plan_approval_response",
  request_id: "plan-xyz789",
  recipient: "architect",
  approve: false,
  content: "Please add error handling for the API calls and consider rate limiting"
})
```

After approval, the teammate automatically exits plan mode and proceeds with implementation. If rejected, the teammate stays in plan mode, revises based on feedback, and resubmits.

---

## Automatic Message Delivery

Messages from teammates are **delivered automatically**. You do NOT need to poll for updates.

When teammates send messages:
- They appear automatically as new conversation turns (like user messages)
- If you're busy (mid-turn), messages are queued and delivered when your turn ends
- The UI shows a brief notification with the sender's name when messages are waiting

---

## Direct Teammate Interaction

You can interact with teammates directly without going through the lead:

- **In-process mode:** Use **Shift+Up/Down** to select a teammate, then type to send them a message. Press **Enter** to view a teammate's session, then **Escape** to interrupt their current turn. Press **Ctrl+T** to toggle the task list.
- **Split-pane mode:** Click into a teammate's pane to interact with their session directly.

---

## Idle Notifications

When a teammate finishes and stops, they automatically notify the lead. This is normal behavior - idle simply means they are waiting for input.

**Key points:**
- Idle teammates **can receive messages**. Sending a message wakes them up.
- Do **not** treat idle as an error. A teammate sending a message and then going idle is the normal flow.
- When a teammate sends a DM to another teammate, a brief summary is included in their idle notification for visibility.

---

## Message Formats

Messages are JSON objects stored in inbox files at `~/.claude/teams/{team}/inboxes/{agent}.json`.

### Regular Message
```json
{
  "from": "team-lead",
  "text": "Please prioritize the auth module",
  "timestamp": "2026-01-25T23:38:32.588Z",
  "read": false
}
```

### Structured Messages (JSON in text field)

#### Shutdown Request
```json
{
  "type": "shutdown_request",
  "requestId": "shutdown-abc123@worker-1",
  "from": "team-lead",
  "reason": "All tasks complete",
  "timestamp": "2026-01-25T23:38:32.588Z"
}
```

#### Shutdown Approved
```json
{
  "type": "shutdown_approved",
  "requestId": "shutdown-abc123@worker-1",
  "from": "worker-1",
  "paneId": "%5",
  "backendType": "in-process",
  "timestamp": "2026-01-25T23:39:00.000Z"
}
```

#### Idle Notification (auto-sent when teammate stops)
```json
{
  "type": "idle_notification",
  "from": "worker-1",
  "timestamp": "2026-01-25T23:40:00.000Z",
  "completedTaskId": "2",
  "completedStatus": "completed"
}
```

#### Task Completed
```json
{
  "type": "task_completed",
  "from": "worker-1",
  "taskId": "2",
  "taskSubject": "Review authentication module",
  "timestamp": "2026-01-25T23:40:00.000Z"
}
```

#### Plan Approval Request
```json
{
  "type": "plan_approval_request",
  "from": "architect",
  "requestId": "plan-xyz789",
  "planContent": "# Implementation Plan\n\n1. ...",
  "timestamp": "2026-01-25T23:41:00.000Z"
}
```

#### Join Request
```json
{
  "type": "join_request",
  "proposedName": "helper",
  "requestId": "join-abc123",
  "capabilities": "Code review and testing",
  "timestamp": "2026-01-25T23:42:00.000Z"
}
```

#### Permission Request (for sandbox/tool permissions)
```json
{
  "type": "permission_request",
  "requestId": "perm-123",
  "workerId": "worker-1@my-project",
  "workerName": "worker-1",
  "workerColor": "#4A90D9",
  "toolName": "Bash",
  "toolUseId": "toolu_abc123",
  "description": "Run npm install",
  "input": {"command": "npm install"},
  "permissionSuggestions": ["Bash(npm *)"],
  "createdAt": 1706000000000
}
```

---

## Debugging Messages

```bash
# Check teammate inboxes
cat ~/.claude/teams/{team}/inboxes/{agent}.json | jq '.'

# Watch for new messages (live)
tail -f ~/.claude/teams/{team}/inboxes/team-lead.json
```
