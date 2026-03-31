<div class="modal fade" id="createGroupModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg">
            <div class="modal-header border-0 pb-0">
                <div>
                    <h5 class="modal-title">Create Group</h5>
                    <p class="text-muted small mb-0">Pick a name and the people you want in the room.</p>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body pt-3">
                <form class="create-group-form">
                    <div class="mb-3">
                        <label for="group_name" class="form-label fw-semibold">Group name</label>
                        <input id="group_name" name="name" type="text" class="form-control" maxlength="60" placeholder="Weekend crew">
                    </div>
                    <div>
                        <div class="d-flex align-items-center justify-content-between mb-2">
                            <label class="form-label fw-semibold mb-0">Members</label>
                            <span class="text-muted small">Select at least one person</span>
                        </div>
                        <div class="create-group-member-list">
                            @foreach ($groupCandidates as $candidate)
                                <label class="create-group-member-item">
                                    <input type="checkbox" name="members[]" value="{{ $candidate->id }}">
                                    <span class="create-group-member-item__avatar">
                                        <img src="{{ asset($candidate->avatar) }}" alt="{{ $candidate->name }}" class="img-fluid">
                                    </span>
                                    <span class="create-group-member-item__copy">
                                        <strong>{{ $candidate->name }}</strong>
                                        <span>{{ $candidate->user_name }}</span>
                                    </span>
                                </label>
                            @endforeach
                        </div>
                    </div>
                    <div class="d-flex justify-content-end gap-2 mt-4">
                        <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create group</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>
