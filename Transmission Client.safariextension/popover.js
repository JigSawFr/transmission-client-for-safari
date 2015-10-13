var backgroundPage;
var safariVisibilityTimer;
var safariPopover;

var taskModel = function(data) {
	var self = this;
	ko.mapping.fromJS(data, {}, self);

	self.filenameDecoded = ko.computed(function() {
		return decodeURIComponent(self.name());
	}, self);

	self.currentRateText = ko.computed(function() {
		if (self.percentDone() == 1)
			return translateSpeed(self.rateUpload());
		else
			return translateSpeed(self.rateDownload());
	}, self);

	self.statusText = ko.computed(function() {
		if(!self.isFinished())
			return translateStatus(self.status());
		else
			return 'Finished';
	}, self);

	self.isPaused = ko.computed(function() {
		return self.status() == 0;
	}, self);

	self.isCompleted = ko.computed(function() {
		return self.isFinished() || (self.percentDone() == 1 && self.status() == 0);
	}, self);

	self.progress = ko.computed(function() {
		return translatePercent(self.percentDone());
	}, self);

	self.totalSize = ko.computed(function() {
		return translateSize(self.sizeWhenDone());
	}, self);

	self.currentSize = ko.computed(function() {
		return self.percentDone()*self.sizeWhenDone();
	}, self);

	self.removed = ko.observable(false);

	self.taskVisible = ko.computed(function() {
		if(self.status() == 0|| self.removed() == true)
			return false;
		return true;
	}, self);
};

var mapping = {
	create:	function(item) {
		return new taskModel(item.data);
	},
	key:	function(item) {
		return ko.utils.unwrapObservable(item.id);
	}
};

function PopoverViewModel() {
	var self = this;
	self.tasks = ko.observableArray();

	self.tasksLength = ko.computed(function() {
		var tasks = self.tasks();
		return tasks.length;
	});

	self.statusText = ko.observable();

	self.completedTasks = ko.computed(function() {
		var tasks = self.tasks();
		var completedTasks = new Array();
		for(var i = 0; i < self.tasks().length; i++)
		{
			if(tasks[i].isCompleted() && tasks[i].removed() == false)
				completedTasks.push(tasks[i]);
		}
		return completedTasks;
	}, self);

	self.removeTask = function(task) {
		backgroundPage.removeTask(task.id());
		task.removed(true);
	};

	self.startTask = function(task) {
		backgroundPage.startTask(task.id());
	};

	self.stopTask = function(task) {
		backgroundPage.stopTask(task.id());
	};

	self.clearQueue = function() {
		var completedTasks = self.completedTasks();
		var completedTaskIds = new Array();
		for(var i = 0; i < completedTasks.length; i++)
		{
				completedTaskIds.push(completedTasks[i].id());
		}
		backgroundPage.clearQueue(completedTaskIds, function(result) {
			// If removing somehow failed, show the tasks again
			if(result == false){
				for(var i = 0; i < completedTasks.length; i++)
					completedTasks[i].removed(false);
			}
		});
		// Remove from list
		for(var i = 0; i < completedTasks.length; i++)
			completedTasks[i].removed(true);
	};

	self.hideTaskElement = function(elem) {
		if (elem.nodeType === 1) {
			$(elem).addClass('hidden');
			setTimeout(function(){ $(elem).remove()},500);
		}
	};

};

function compareTasks(taskA, taskB) {
	if(taskA.id() == taskB.id())
		return true;
	else
		return false;
}

function updateTasks(tasks) {
	// Re-create array to avoid problems with knockout mapping
	var taskArray = new Array();
	for(var i = 0; i < tasks.length; i++) {
		taskArray.push(tasks[i]);
/* 		console.log(tasks[i]); */
	}
/* 	console.log(taskArray); */
	ko.mapping.fromJS(taskArray, mapping, viewModel.tasks);
	if (viewModel.tasksLength == 0)
		setInfo("You have no downloads currently.");
	else
		setInfo("");
	updatePopoverHeight();
}

/* Main Trigger */
var viewModel = new PopoverViewModel();
ko.applyBindings(viewModel);

$(document).ready(function() {
/* 	setInterval('updatePopoverHeight()', 10); */
	// !Initialize popover
	backgroundPage = getBackgroundPage();

	$(window).unload(function() {
		backgroundPage.popupClosed();
	});

	// Set a timer for Safari to check the visibility of the popover since there's no event for that
	if(isSafari) {
		var popovers = getSafariPopoverObjects();
		$.each(popovers, function(index, popover) {
			if(popover.identifier == "statusPopover")
				safariPopover = popover;
		});

		// Event when popover is displayed
		safari.application.addEventListener("popover", function(evt) {
			if(evt.target.identifier == "statusPopover") {
				backgroundPage.popupOpen();

				var safariVisibilityTimer = setInterval(function() {
					if(safariPopover.visible == false) {
						backgroundPage.popupClosed();
						clearInterval(safariVisibilityTimer);
					}
				}, 1000);
			}
		}, true);
	}
});

function setInfo(message) {
	if(message != null && $.trim(message).length == 0)
		message = null;
	viewModel.statusText(message);
}

function translatePercent(progress) {
  var prog = progress*100;
  if(prog == 100)
    return '100%';
  else
    return prog.toFixed(2) +'%';
}

var KILOBYTE = 1024;
var MEGABYTE = 1048576;
var GIGABYTE = 1073741824;

function translateSpeed(bytes) {
  if (bytes <= 0) {
    return '(0 B/s)';
  } else if (bytes < KILOBYTE) {
    return '(' + Math.round(bytes) + ' B/s)'
  } else if (bytes < MEGABYTE) {
    return '(' + Math.round(bytes/KILOBYTE) + ' KB/s)';
  } else {
    return '(' + Math.round((bytes/MEGABYTE)*100)/100 + ' MB/s)';
  }
}

function translateSize(bytes) {

  if (bytes <= 0) {
    return "0";
  } else if (bytes < KILOBYTE) {
    return Math.round(bytes) + ' B'
  } else if (bytes < MEGABYTE) {
    return Math.round(bytes/KILOBYTE) + ' KB';
  } else if (bytes < GIGABYTE) {
    return Math.round((bytes/MEGABYTE)*100)/100 + ' MB';
  }  else {
    return Math.round((bytes/GIGABYTE)*100)/100 + ' GB';
  }
}

function translateStatus(synostatus) {
	switch (synostatus) {
		case 0:
			return 'Paused';
		case 4:
			return getLocalizedString('Downloading');
		case 6:
			return getLocalizedString('Seeding');
		default:
			return getLocalizedString('Status Unknown');
	}
}

function updatePopoverHeight() {
	// Only for Safari, Chrome uses the document height
	if(isSafari && safariPopover != undefined && safariPopover != null) {
		safariPopover.height = document.documentElement.offsetHeight;
	}
}

function getLocalizedString(text) {
	return text;
}
