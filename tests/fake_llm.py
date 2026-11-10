class FakeLLM:
	"""responses: {agent_name: str | [str, ...]}. Last item repeats."""

	def __init__(self, responses):
		self.responses = {k: [v] if isinstance(v, str) else list(v) for k, v in responses.items()}
		self.calls = []

	def __call__(self, name, system, user):
		self.calls.append((name, system, user))
		q = self.responses[name]
		return q.pop(0) if len(q) > 1 else q[0]
