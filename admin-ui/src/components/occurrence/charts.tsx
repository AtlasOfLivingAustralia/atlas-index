
interface ChartsProps {
    results?: {},
    search?: string
}

function Charts({results, search}: ChartsProps) {
    return <>
        Charts {results && "true"} {search}
    </>
}

export default Charts;

// import React from "react";
//
// <div id="alert" className="modal fade" tabIndex="-1" role="dialog" aria-labelledby="alertLabel"
//      aria-hidden="true">
//     <div className="modal-dialog" role="document">
//         <div className="modal-content">
//             <div className="modal-header">
//                 <button type="button" className="close" data-dismiss="modal" aria-hidden="true">×
//                 </button>
//
//                 <h3 id="myModalLabel">Email alerts</h3>
//             </div>
//
//             <div className="modal-body">
//                 <div className="">
//                     <a href="#alertNewRecords" id="alertNewRecords"
//                        className="btn tooltips btn-default"
//                        data-method="createBiocacheNewRecordsAlert"
//                        title="Notify me when new records come online for this search">Get email
//                         alerts for new <u>records</u></a>
//                 </div>
//                 <br/>
//
//                 <div className="">
//                     <a href="#alertNewAnnotations" id="alertNewAnnotations"
//                        data-method="createBiocacheNewAnnotationsAlert"
//                        className="btn tooltips btn-default"
//                        title="Notify me when new annotations (corrections, comments, etc) come online for this search">Get
//                         email alerts for new <u>annotations</u></a>
//                 </div>
//                 <p>&nbsp;</p>
//                 <p><a href="https://alerts.ala.org.au/notification/myAlerts">View your current
//                     alerts</a></p>
//             </div>
//             <div className="modal-footer">
//                 <button className="btn btn-default" data-dismiss="modal" aria-hidden="true">Close
//                 </button>
//             </div>
//         </div>
//         <!-- /.modal-content -->
//     </div>
//     <!-- /.modal-dialog -->
// </div>
// <!-- /#alerts -->
