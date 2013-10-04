# -*- coding: utf-8 -*-

# Copyright (c) 2012-2013 CoNWeT Lab., Universidad Politécnica de Madrid

# This file is part of Wirecloud.

# Wirecloud is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# Wirecloud is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.

# You should have received a copy of the GNU Affero General Public License
# along with Wirecloud.  If not, see <http://www.gnu.org/licenses/>.

import os

from wirecloud.commons.utils.testcases import WirecloudSeleniumTestCase
from wirecloud.fiware.tests.store import DynamicWebServer, FakeNetwork, LocalFileSystemServer


__test__ = False


def read_response_file(*response):
    f = open(os.path.join(os.path.dirname(__file__), 'test-data', *response))
    contents = f.read()
    f.close()

    return contents


class FiWareSeleniumTestCase(WirecloudSeleniumTestCase):

    fixtures = ('initial_data', 'selenium_test_data', 'fiware_test_data')
    tags = ('pure-fiware',)

    @classmethod
    def setUpClass(cls):

        WirecloudSeleniumTestCase.setUpClass.im_func(cls)

        cls.network = FakeNetwork({
            'http': {
                'marketplace.example.com': DynamicWebServer(),
                'repository.example.com': LocalFileSystemServer(os.path.join(os.path.dirname(__file__), 'test-data', 'responses', 'repository')),
                'static.example.com': LocalFileSystemServer(os.path.join(os.path.dirname(__file__), 'test-data', 'responses', 'static')),
            },
        })
        cls.network.mock_requests()

        cls.store_list_response = read_response_file('responses', 'marketplace', 'store_list.xml')
        cls.store1_offerings = read_response_file('responses', 'marketplace', 'store1_offerings.xml')
        cls.store2_offerings = read_response_file('responses', 'marketplace', 'store2_offerings.xml')

    @classmethod
    def tearDownClass(cls):

        WirecloudSeleniumTestCase.tearDownClass.im_func(cls)

        cls.network.unmock_requests()

    def setUp(self):

        super(FiWareSeleniumTestCase, self).setUp()

        self.network._servers['http']['marketplace.example.com'].clear()
        self.network._servers['http']['marketplace.example.com'].add_response('GET', '/registration/stores/', {'content': self.store_list_response})
        self.network._servers['http']['marketplace.example.com'].add_response('GET', '/offering/store/Store%201/offerings', {'content': self.store1_offerings})
        self.network._servers['http']['marketplace.example.com'].add_response('GET', '/offering/store/Store%202/offerings', {'content': self.store2_offerings})

    def test_add_fiware_marketplace(self):

        self.login()

        self.add_marketplace('fiware', 'http://marketplace.example.com/', 'fiware')
        widget_offering = self.search_in_catalogue_results('Smart City Lights application')
        self.assertIsNotNone(widget_offering)
    test_add_fiware_marketplace.tags = ('pure-fiware', 'fiware-ut-8')

    def test_delete_fiware_marketplace(self):

        self.login(username='user_with_markets')

        self.delete_marketplace('fiware')
    test_delete_fiware_marketplace.tags = ('pure-fiware', 'fiware-ut-8')

    def test_ngsi_available_to_widgets(self):

        self.login()

        resource = self.add_packaged_resource_to_catalogue('Wirecloud_ngsi-test-widget_1.0.1.wgt', 'Wirecloud NGSI API test widget')
        iwidget = self.instantiate(resource)

        with iwidget:
            api_element = self.driver.find_element_by_id('api_available')
            self.assertEqual(api_element.text, 'Yes')
    test_ngsi_available_to_widgets.tags = ('pure-fiware', 'fiware-ut-7')

    def test_objectstorage_available_to_widgets(self):

        self.login()

        resource = self.add_packaged_resource_to_catalogue('Wirecloud_objectstorage-test-widget_1.0.wgt', 'Wirecloud Object Storage API test widget')
        iwidget = self.instantiate(resource)

        with iwidget:
            api_element = self.driver.find_element_by_id('api_available')
            self.assertEqual(api_element.text, 'Yes')
    test_objectstorage_available_to_widgets.tags = ('pure-fiware', 'fiware-ut-12')
