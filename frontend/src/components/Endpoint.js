import {Card, CardBody, CardFooter, Heading, CardHeader, Button} from "grommet";
import {BarChart, Power} from "grommet-icons";
import axios from "axios";


const Endpoint = (props) => {

    const  updateEndpoint = (id, data) => {
        axios.put(`http://10.0.0.250:8000/api/host/${id}`, data)
            .then(function (response) {
                // handle success
                console.log(response.data);
                console.log(`${Date.now()} TEST`)
                props.handleRefresh()

            })
            .catch(function (error) {
                // handle error
                console.log(error);
            })
            .finally(function () {
                // always executed
            });

    }

    const logToConsole = () => {
        console.log(`${Date.now()} - ${props.id}`)
        const endpoint_put_data = {"hostname": props.hostname, "ip_address": props.ip_address, "active": !props.active}
        updateEndpoint(props.id, endpoint_put_data)
    }


    return (
        <Card background={props.is_alive ? "light-1" : "red"} key={props.id}>
            <CardHeader pad="small">
                <Heading level={5} margin="none">
                    {props.hostname}
                </Heading>
            </CardHeader>
            <CardBody pad="small">
                <div>{props.ip_address}</div>
                <div>{props.avg_rtt}ms</div>
            </CardBody>
            <CardFooter pad={{horizontal: "small"}} background="light-3">
                <Button icon={props.active ? <Power color="green"/> : <Power color="red"/>} onClick={()=> logToConsole()} hoverIndicator/>
                {/*<Button icon={<Favorite color="red"/>} hoverIndicator/>*/}
                <Button icon={<BarChart color="plain"/>} hoverIndicator/>
            </CardFooter>
        </Card>

    )
}

export default Endpoint